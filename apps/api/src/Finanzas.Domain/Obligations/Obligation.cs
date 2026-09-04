using Finanzas.Domain.Common;
using Finanzas.Domain.Identifiers;
using Finanzas.Domain.ValueObjects;

namespace Finanzas.Domain.Obligations;

/// <summary>Sentido de la obligación respecto al titular.</summary>
public enum ObligationDirection
{
    /// <summary>Cuenta por cobrar: la contraparte me debe.</summary>
    Receivable = 1,

    /// <summary>Deuda propia: yo le debo a la contraparte.</summary>
    Payable = 2,
}

/// <summary>Hecho que originó la obligación (§W11).</summary>
public enum ObligationOrigin
{
    /// <summary>Compra con tarjeta asignada a una persona.</summary>
    CardPurchase = 1,

    /// <summary>Préstamo directo de dinero.</summary>
    DirectLoan = 2,

    /// <summary>Ajuste documentado.</summary>
    Adjustment = 3,
}

public enum ObligationStatus
{
    Open = 1,

    /// <summary>Saldada: saldo cero y cierre registrado.</summary>
    Settled = 2,

    /// <summary>Anulada sin cobro. Conserva todo el histórico.</summary>
    Cancelled = 3,
}

/// <summary>
/// Obligación entre el titular y una contraparte (§W11). Su saldo <b>se deriva</b>
/// del ledger de asientos; no existe un campo "saldo" editable
/// (regla financiera 1).
/// </summary>
/// <remarks>
/// <para><b>Regla 3 — deuda propia ≠ cuenta por cobrar.</b>
/// <see cref="Direction"/> nunca se compensa: una obligación por cobrar a una
/// persona no reduce lo que el titular debe al emisor de la tarjeta. Los cargos
/// por compra asignada no mueven caja
/// (<c>MovementKind.LoanCharge</c> solo admite <c>CashFlow.None</c>), así que la
/// deuda bancaria derivada del ledger queda intacta.</para>
/// <para><b>Regla 6 — un abono no reescribe el importe original.</b> Nada se
/// edita: se añaden asientos, y corregir es reversar.</para>
/// <para><b>Regla 8 — no se recalculan periodos cerrados.</b>
/// <see cref="ClosedThrough"/> congela el pasado y la política de interés es una
/// serie con vigencias, no un campo.</para>
/// </remarks>
public sealed class Obligation : AggregateRoot<ObligationId>
{
    private readonly List<ObligationEntry> _entries = [];
    private readonly List<InterestPolicyTerm> _policies = [];

    private Obligation(
        ObligationId id,
        CounterpartyId counterparty,
        ObligationDirection direction,
        ObligationOrigin origin,
        Currency currency,
        DateOnly openedOn,
        DateOnly? dueOn,
        PaymentAllocationRule allocationRule,
        bool allowsOverpayment,
        CardId? card,
        AccountId? account,
        string? description,
        DateTimeOffset createdAt)
        : base(id)
    {
        Counterparty = counterparty;
        Direction = direction;
        Origin = origin;
        Currency = currency;
        OpenedOn = openedOn;
        DueOn = dueOn;
        AllocationRule = allocationRule;
        AllowsOverpayment = allowsOverpayment;
        Card = card;
        Account = account;
        Description = description;
        CreatedAt = createdAt;
        Status = ObligationStatus.Open;
    }

    public CounterpartyId Counterparty { get; }

    public ObligationDirection Direction { get; }

    public ObligationOrigin Origin { get; }

    /// <summary>Moneda de la obligación. Todos sus asientos van en ella.</summary>
    public Currency Currency { get; }

    public DateOnly OpenedOn { get; }

    public DateOnly? DueOn { get; private set; }

    public PaymentAllocationRule AllocationRule { get; private set; }

    /// <summary>Permite abonos por encima del saldo (sobrepago controlado).</summary>
    public bool AllowsOverpayment { get; private set; }

    public CardId? Card { get; }

    public AccountId? Account { get; }

    public string? Description { get; private set; }

    public ObligationStatus Status { get; private set; }

    /// <summary>Última fecha con periodo cerrado; nada anterior se puede tocar.</summary>
    public DateOnly? ClosedThrough { get; private set; }

    public DateTimeOffset CreatedAt { get; }

    public IReadOnlyList<ObligationEntry> Entries =>
        _entries.OrderBy(entry => entry.Date).ThenBy(entry => entry.CreatedAt).ToArray();

    public IReadOnlyList<InterestPolicyTerm> InterestPolicies =>
        _policies.OrderBy(term => term.EffectiveFrom).ToArray();

    public bool IsReceivable => Direction == ObligationDirection.Receivable;

    public Money PrincipalOutstanding => SumPrincipal(_entries);

    public Money InterestOutstanding => SumInterest(_entries);

    public Money TotalOutstanding => PrincipalOutstanding + InterestOutstanding;

    public Money PrincipalOutstandingAt(DateOnly asOf) => SumPrincipal(_entries.Where(e => e.Date <= asOf));

    public Money InterestOutstandingAt(DateOnly asOf) => SumInterest(_entries.Where(e => e.Date <= asOf));

    public Money TotalOutstandingAt(DateOnly asOf) => PrincipalOutstandingAt(asOf) + InterestOutstandingAt(asOf);

    public static Obligation Create(
        ObligationId id,
        CounterpartyId counterparty,
        ObligationDirection direction,
        ObligationOrigin origin,
        Currency currency,
        DateOnly openedOn,
        DateTimeOffset createdAt,
        PaymentAllocationRule allocationRule = PaymentAllocationRule.InterestFirst,
        InterestPolicy? interestPolicy = null,
        DateOnly? dueOn = null,
        bool allowsOverpayment = false,
        CardId? card = null,
        AccountId? account = null,
        string? description = null)
    {
        Guard.NotNull(currency);
        Guard.Require(
            dueOn is null || dueOn.Value >= openedOn,
            DomainErrorCodes.InvalidDateRange,
            "El vencimiento no puede ser anterior a la apertura.");

        Guard.Require(
            origin != ObligationOrigin.CardPurchase || card is not null,
            DomainErrorCodes.InvariantViolation,
            "Una obligación originada en una compra con tarjeta debe indicar la tarjeta.");

        var obligation = new Obligation(
            id,
            counterparty,
            direction,
            origin,
            currency,
            openedOn,
            dueOn,
            allocationRule,
            allowsOverpayment,
            card,
            account,
            string.IsNullOrWhiteSpace(description) ? null : description.Trim(),
            createdAt);

        obligation._policies.Add(new InterestPolicyTerm(openedOn, interestPolicy ?? InterestPolicy.None));
        return obligation;
    }

    /// <summary>Política de interés vigente en una fecha.</summary>
    public InterestPolicy PolicyOn(DateOnly date) =>
        _policies.Where(term => term.EffectiveFrom <= date)
            .OrderByDescending(term => term.EffectiveFrom)
            .Select(term => term.Policy)
            .FirstOrDefault() ?? InterestPolicy.None;

    /// <summary>
    /// Cambia la política de interés a partir de una fecha. No puede tener
    /// efecto dentro de un periodo ya cerrado (regla financiera 8).
    /// </summary>
    public void ChangeInterestPolicy(InterestPolicy policy, DateOnly effectiveFrom)
    {
        Guard.NotNull(policy);
        EnsureOpen();
        EnsureAfterClosedPeriod(effectiveFrom, "cambiar la política de interés");

        _policies.RemoveAll(term => term.EffectiveFrom == effectiveFrom);
        _policies.Add(new InterestPolicyTerm(effectiveFrom, policy));
    }

    public void ChangeAllocationRule(PaymentAllocationRule rule)
    {
        EnsureOpen();
        AllocationRule = rule;
    }

    public void AllowOverpayment(bool allowed)
    {
        EnsureOpen();
        AllowsOverpayment = allowed;
    }

    public void Reschedule(DateOnly? dueOn)
    {
        EnsureOpen();
        Guard.Require(
            dueOn is null || dueOn.Value >= OpenedOn,
            DomainErrorCodes.InvalidDateRange,
            "El vencimiento no puede ser anterior a la apertura.");
        DueOn = dueOn;
    }

    /// <summary>Desembolso de capital respaldado por un movimiento del ledger.</summary>
    public ObligationEntry RegisterDisbursement(
        ObligationEntryId entryId,
        DateOnly date,
        Money amount,
        MovementId movement,
        DateTimeOffset createdAt,
        string? note = null) =>
        AddEntry(ObligationEntry.Create(
            entryId,
            ObligationEntryType.Disbursement,
            date,
            EnsurePositive(amount),
            Money.Zero(Currency),
            createdAt,
            movement,
            note: note));

    /// <summary>
    /// Cargo sin desembolso: la compra ya movió el dinero en la tarjeta y aquí
    /// solo nace la cuenta por cobrar.
    /// </summary>
    public ObligationEntry RegisterCharge(
        ObligationEntryId entryId,
        DateOnly date,
        Money amount,
        DateTimeOffset createdAt,
        MovementId? movement = null,
        string? note = null) =>
        AddEntry(ObligationEntry.Create(
            entryId,
            ObligationEntryType.Charge,
            date,
            EnsurePositive(amount),
            Money.Zero(Currency),
            createdAt,
            movement,
            note: note));

    /// <summary>Interés con importe explícito.</summary>
    public ObligationEntry RegisterInterest(
        ObligationEntryId entryId,
        DateOnly date,
        Money amount,
        DateTimeOffset createdAt,
        MovementId? movement = null,
        string? note = null) =>
        AddEntry(ObligationEntry.Create(
            entryId,
            ObligationEntryType.Interest,
            date,
            Money.Zero(Currency),
            EnsurePositive(amount),
            createdAt,
            movement,
            note: note));

    /// <summary>
    /// Devenga el interés de un periodo con la política vigente al inicio del
    /// periodo y el capital pendiente a esa fecha. Devuelve <c>null</c> si no
    /// hay interés que devengar.
    /// </summary>
    public ObligationEntry? AccrueInterest(
        ObligationEntryId entryId,
        DateRange period,
        DateTimeOffset createdAt,
        MovementId? movement = null)
    {
        EnsureOpen();
        EnsureAfterClosedPeriod(period.Start, "devengar interés");

        var policy = PolicyOn(period.Start);
        var interest = policy.Accrue(PrincipalOutstandingAt(period.Start), period);

        if (!interest.IsPositive)
        {
            return null;
        }

        return RegisterInterest(
            entryId,
            period.End,
            interest,
            createdAt,
            movement,
            $"Interés {policy} {period}");
    }

    /// <summary>
    /// Registra un abono aplicándolo según la regla vigente. Las partes suman
    /// exactamente el importe recibido: el reparto usa
    /// <see cref="Money.Allocate(IReadOnlyList{decimal})"/> y no pierde centavos.
    /// </summary>
    public (ObligationEntry Entry, PaymentAllocation Allocation) RegisterPayment(
        ObligationEntryId entryId,
        DateOnly date,
        Money amount,
        MovementId movement,
        DateTimeOffset createdAt,
        PaymentAllocationRule? rule = null,
        string? note = null)
    {
        EnsurePositive(amount);
        var effectiveRule = rule ?? AllocationRule;

        Guard.Require(
            effectiveRule != PaymentAllocationRule.Manual,
            DomainErrorCodes.ObligationManualAllocationRequired,
            "La regla manual exige indicar capital e interés con RegisterManualPayment.");

        var allocation = Allocate(amount, effectiveRule);

        var entry = AddEntry(ObligationEntry.Create(
            entryId,
            ObligationEntryType.Payment,
            date,
            (allocation.Principal + allocation.Excess).Negate(),
            allocation.Interest.Negate(),
            createdAt,
            movement,
            note: note));

        return (entry, allocation);
    }

    /// <summary>Abono con reparto indicado por el usuario (regla manual).</summary>
    public (ObligationEntry Entry, PaymentAllocation Allocation) RegisterManualPayment(
        ObligationEntryId entryId,
        DateOnly date,
        Money principalPart,
        Money interestPart,
        MovementId movement,
        DateTimeOffset createdAt,
        string? note = null)
    {
        EnsureCurrency(principalPart);
        EnsureCurrency(interestPart);
        Guard.NonNegative(principalPart.Amount, DomainErrorCodes.InvalidAmount, nameof(principalPart));
        Guard.NonNegative(interestPart.Amount, DomainErrorCodes.InvalidAmount, nameof(interestPart));

        var amount = principalPart + interestPart;
        EnsurePositive(amount);

        var excess = amount - Max(Money.Zero(Currency), Min(amount, TotalOutstanding));
        EnsureOverpaymentAllowed(excess);

        var allocation = new PaymentAllocation(principalPart, interestPart, Money.Zero(Currency));

        var entry = AddEntry(ObligationEntry.Create(
            entryId,
            ObligationEntryType.Payment,
            date,
            principalPart.Negate(),
            interestPart.Negate(),
            createdAt,
            movement,
            note: note));

        return (entry, allocation);
    }

    /// <summary>Ajuste documentado del saldo (condonación, corrección).</summary>
    public ObligationEntry RegisterAdjustment(
        ObligationEntryId entryId,
        DateOnly date,
        Money principalDelta,
        Money interestDelta,
        DateTimeOffset createdAt,
        MovementId? movement = null,
        string? note = null)
    {
        EnsureCurrency(principalDelta);
        EnsureCurrency(interestDelta);
        Guard.Require(
            !principalDelta.IsZero || !interestDelta.IsZero,
            DomainErrorCodes.InvalidAmount,
            "Un ajuste debe mover capital o interés.");

        return AddEntry(ObligationEntry.Create(
            entryId,
            ObligationEntryType.Adjustment,
            date,
            principalDelta,
            interestDelta,
            createdAt,
            movement,
            note: note));
    }

    /// <summary>
    /// Reversa un asiento: añade su espejo con signo contrario y marca el
    /// original. El original nunca se borra ni se edita (regla financiera 6).
    /// </summary>
    public ObligationEntry ReverseEntry(
        ObligationEntryId reversalId,
        ObligationEntryId targetId,
        DateOnly date,
        DateTimeOffset createdAt,
        MovementId? movement = null,
        string? note = null)
    {
        var target = _entries.FirstOrDefault(entry => entry.Id == targetId)
            ?? throw new InvariantViolationException(
                DomainErrorCodes.ObligationEntryNotFound,
                $"La obligación {Id} no tiene el asiento {targetId}.");

        Guard.Require(
            date >= target.Date,
            DomainErrorCodes.InvalidDateRange,
            "El reverso no puede ser anterior al asiento que anula.");

        var reversal = ObligationEntry.Create(
            reversalId,
            ObligationEntryType.Reversal,
            date,
            target.PrincipalDelta.Negate(),
            target.InterestDelta.Negate(),
            createdAt,
            movement,
            reversalOf: targetId,
            note: note ?? $"Reverso de {targetId}");

        AddEntry(reversal);
        target.MarkReversedBy(reversalId);
        return reversal;
    }

    /// <summary>
    /// Cierra los periodos hasta una fecha. A partir de ahí, ningún asiento ni
    /// cambio de política puede tocar lo anterior.
    /// </summary>
    public void CloseThrough(DateOnly date)
    {
        EnsureOpen();
        Guard.Require(
            ClosedThrough is null || date >= ClosedThrough.Value,
            DomainErrorCodes.ObligationClosedPeriod,
            $"El periodo ya está cerrado hasta {ClosedThrough:yyyy-MM-dd}; no se puede reabrir.");
        ClosedThrough = date;
    }

    /// <summary>
    /// Marca la obligación como saldada. Exige saldo cero: cerrar no genera
    /// ingreso ni gasto por sí solo (regla financiera 2).
    /// </summary>
    public ObligationEntry Settle(ObligationEntryId entryId, DateOnly date, DateTimeOffset createdAt, string? note = null)
    {
        EnsureOpen();
        Guard.Require(
            TotalOutstanding.IsZero,
            DomainErrorCodes.ObligationOutstandingNotZero,
            $"No se puede saldar la obligación {Id}: pendiente {TotalOutstanding}.");

        var entry = AddEntry(ObligationEntry.Create(
            entryId,
            ObligationEntryType.Closure,
            date,
            Money.Zero(Currency),
            Money.Zero(Currency),
            createdAt,
            note: note));

        Status = ObligationStatus.Settled;
        return entry;
    }

    /// <summary>Anula la obligación conservando todo su histórico.</summary>
    public void Cancel(string reason)
    {
        EnsureOpen();
        Description = string.IsNullOrWhiteSpace(Description)
            ? $"Anulada: {Guard.NotBlank(reason)}"
            : $"{Description} · Anulada: {Guard.NotBlank(reason)}";
        Status = ObligationStatus.Cancelled;
    }

    /// <summary>Reabre una obligación saldada si aparece un asiento posterior.</summary>
    public void Reopen()
    {
        Guard.Require(
            Status == ObligationStatus.Settled,
            DomainErrorCodes.ObligationNotOpen,
            $"Solo se reabre una obligación saldada (estado actual: {Status}).");
        Status = ObligationStatus.Open;
    }

    /// <summary>Calcula el reparto de un abono sin registrarlo.</summary>
    public PaymentAllocation Allocate(Money amount, PaymentAllocationRule rule)
    {
        EnsureCurrency(amount);
        Guard.Positive(amount.Amount, DomainErrorCodes.InvalidAmount, nameof(amount));

        var principalDue = Max(Money.Zero(Currency), PrincipalOutstanding);
        var interestDue = Max(Money.Zero(Currency), InterestOutstanding);
        var totalDue = principalDue + interestDue;

        var applicable = Min(amount, totalDue);
        var excess = amount - applicable;
        EnsureOverpaymentAllowed(excess);

        Money principal;
        Money interest;

        switch (rule)
        {
            case PaymentAllocationRule.PrincipalFirst:
                principal = Min(applicable, principalDue);
                interest = applicable - principal;
                break;

            case PaymentAllocationRule.InterestFirst:
                interest = Min(applicable, interestDue);
                principal = applicable - interest;
                break;

            case PaymentAllocationRule.Proportional:
                if (totalDue.IsZero)
                {
                    principal = Money.Zero(Currency);
                    interest = Money.Zero(Currency);
                }
                else
                {
                    var parts = applicable.Allocate([principalDue.Amount, interestDue.Amount]);
                    principal = parts[0];
                    interest = parts[1];
                }

                break;

            case PaymentAllocationRule.Manual:
                throw new InvariantViolationException(
                    DomainErrorCodes.ObligationManualAllocationRequired,
                    "La regla manual exige indicar capital e interés explícitamente.");

            default:
                throw new InvariantViolationException(
                    DomainErrorCodes.InvariantViolation,
                    $"Regla de aplicación no soportada: {rule}.");
        }

        var allocation = new PaymentAllocation(principal, interest, excess);

        // Invariante dura: el reparto no crea ni pierde dinero.
        Guard.Require(
            allocation.Total == amount,
            DomainErrorCodes.ObligationAllocationMismatch,
            $"El reparto {allocation.Total} no coincide con el abono {amount}.");

        return allocation;
    }

    private ObligationEntry AddEntry(ObligationEntry entry)
    {
        EnsureOpen();
        EnsureCurrency(entry.PrincipalDelta);
        EnsureCurrency(entry.InterestDelta);
        EnsureAfterClosedPeriod(entry.Date, $"registrar un asiento de tipo {entry.Type}");

        Guard.Require(
            _entries.All(existing => existing.Id != entry.Id),
            DomainErrorCodes.InvariantViolation,
            $"El asiento {entry.Id} ya existe en la obligación {Id}.");

        Guard.Require(
            entry.Movement is null || _entries.All(existing => existing.Movement != entry.Movement),
            DomainErrorCodes.InvariantViolation,
            $"El movimiento {entry.Movement} ya está asentado en la obligación {Id}.");

        _entries.Add(entry);
        return entry;
    }

    private void EnsureOpen() =>
        Guard.Require(
            Status == ObligationStatus.Open,
            DomainErrorCodes.ObligationNotOpen,
            $"La obligación {Id} está {Status} y no admite cambios.");

    private void EnsureAfterClosedPeriod(DateOnly date, string action) =>
        Guard.Require(
            ClosedThrough is null || date > ClosedThrough.Value,
            DomainErrorCodes.ObligationClosedPeriod,
            $"No se puede {action} con fecha {date:yyyy-MM-dd}: el periodo está cerrado hasta {ClosedThrough:yyyy-MM-dd}.");

    private void EnsureOverpaymentAllowed(Money excess) =>
        Guard.Require(
            !excess.IsPositive || AllowsOverpayment,
            DomainErrorCodes.ObligationOverpayment,
            $"El abono excede el saldo pendiente en {excess} y la obligación no admite sobrepagos.");

    private void EnsureCurrency(Money amount)
    {
        Guard.NotNull(amount);
        Guard.Require(
            amount.Currency == Currency,
            DomainErrorCodes.CurrencyMismatch,
            $"La obligación está en {Currency.Code} y el importe en {amount.Currency.Code}.");
    }

    private Money EnsurePositive(Money amount)
    {
        EnsureCurrency(amount);
        Guard.Positive(amount.Amount, DomainErrorCodes.InvalidAmount, nameof(amount));
        return amount;
    }

    private Money SumPrincipal(IEnumerable<ObligationEntry> entries) =>
        entries.Aggregate(Money.Zero(Currency), (total, entry) => total + entry.PrincipalDelta);

    private Money SumInterest(IEnumerable<ObligationEntry> entries) =>
        entries.Aggregate(Money.Zero(Currency), (total, entry) => total + entry.InterestDelta);

    private static Money Min(Money left, Money right) => left <= right ? left : right;

    private static Money Max(Money left, Money right) => left >= right ? left : right;

    public override string ToString() =>
        $"{Direction} {Currency.Code} pendiente {TotalOutstanding} ({Status})";
}
