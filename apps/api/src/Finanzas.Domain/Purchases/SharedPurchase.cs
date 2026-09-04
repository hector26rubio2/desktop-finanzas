using Finanzas.Domain.Common;
using Finanzas.Domain.Identifiers;
using Finanzas.Domain.ValueObjects;

namespace Finanzas.Domain.Purchases;

/// <summary>Forma de asignar una parte de la compra a una persona.</summary>
public enum ShareBasis
{
    /// <summary>La compra completa es de esa persona (100 %).</summary>
    Full = 1,

    /// <summary>Un porcentaje del total.</summary>
    Percentage = 2,

    /// <summary>Un importe fijo del total.</summary>
    FixedAmount = 3,
}

/// <summary>Definición de la parte asignada a una persona.</summary>
public sealed record PurchaseShare
{
    private PurchaseShare(
        CounterpartyId counterparty,
        ShareBasis basis,
        Percentage? percent,
        Money? fixedAmount,
        ObligationId? obligation)
    {
        Counterparty = counterparty;
        Basis = basis;
        Percent = percent;
        FixedAmount = fixedAmount;
        Obligation = obligation;
    }

    public CounterpartyId Counterparty { get; }

    public ShareBasis Basis { get; }

    public Percentage? Percent { get; }

    public Money? FixedAmount { get; }

    /// <summary>Obligación que materializa la parte, cuando ya se creó.</summary>
    public ObligationId? Obligation { get; init; }

    public static PurchaseShare Full(CounterpartyId counterparty, ObligationId? obligation = null) =>
        new(counterparty, ShareBasis.Full, Percentage.FromPercent(100m), null, obligation);

    public static PurchaseShare OfPercentage(CounterpartyId counterparty, Percentage percent, ObligationId? obligation = null)
    {
        Guard.Require(
            percent.Percent > 0m && percent.Percent <= 100m,
            DomainErrorCodes.ShareInvalidBasis,
            $"Una participación porcentual debe estar entre 0 % y 100 % (recibido {percent}).");
        return new PurchaseShare(counterparty, ShareBasis.Percentage, percent, null, obligation);
    }

    public static PurchaseShare OfAmount(CounterpartyId counterparty, Money amount, ObligationId? obligation = null)
    {
        Guard.NotNull(amount);
        Guard.Positive(amount.Amount, DomainErrorCodes.ShareInvalidBasis, nameof(amount));
        return new PurchaseShare(counterparty, ShareBasis.FixedAmount, null, amount, obligation);
    }
}

/// <summary>Parte ya resuelta a un importe concreto.</summary>
/// <param name="Definition">Definición de la parte.</param>
/// <param name="Amount">Importe asignado.</param>
/// <param name="RoundingAdjustment">
/// Diferencia frente al cálculo ingenuo <c>total × porcentaje</c>, producto del
/// reparto exacto. §W6 exige registrar los redondeos, no esconderlos.
/// </param>
public sealed record ResolvedShare(PurchaseShare Definition, Money Amount, Money RoundingAdjustment);

/// <summary>Reparto completo de una compra entre personas y el titular.</summary>
public sealed record PurchaseAllocation(
    IReadOnlyList<ResolvedShare> Shares,
    Money AssignedTotal,
    Money HolderPortion,
    Money RoundingAdjustment);

/// <summary>
/// Compra con tarjeta asignada total o parcialmente a otras personas (§W6, §W11).
/// </summary>
/// <remarks>
/// <b>Regla financiera 3.</b> Asignar una compra no toca la deuda con el emisor:
/// aquí no nace ningún movimiento sobre la tarjeta. Lo que nace es una cuenta
/// por cobrar por persona, cuyo cargo
/// (<c>MovementKind.LoanCharge</c>) tiene flujo de caja nulo por
/// especificación. La porción del titular nunca desaparece: es
/// <see cref="PurchaseAllocation.HolderPortion"/> y no puede ser negativa.
/// </remarks>
public sealed class SharedPurchase : AggregateRoot<SharedPurchaseId>
{
    private readonly List<PurchaseShare> _shares = [];

    private SharedPurchase(
        SharedPurchaseId id,
        MovementId purchaseMovement,
        CardId card,
        DateOnly date,
        Money total,
        string? description,
        DateTimeOffset createdAt)
        : base(id)
    {
        PurchaseMovement = purchaseMovement;
        Card = card;
        Date = date;
        Total = total;
        Description = description;
        CreatedAt = createdAt;
    }

    /// <summary>Movimiento de compra en el ledger: la única fuente del importe.</summary>
    public MovementId PurchaseMovement { get; }

    public CardId Card { get; }

    public DateOnly Date { get; }

    /// <summary>Importe financiado total de la compra.</summary>
    public Money Total { get; }

    public string? Description { get; }

    public DateTimeOffset CreatedAt { get; }

    public IReadOnlyList<PurchaseShare> Shares => _shares;

    public Currency Currency => Total.Currency;

    public static SharedPurchase Create(
        SharedPurchaseId id,
        MovementId purchaseMovement,
        CardId card,
        DateOnly date,
        Money total,
        DateTimeOffset createdAt,
        string? description = null)
    {
        Guard.NotNull(total);
        Guard.Positive(total.Amount, DomainErrorCodes.InvalidAmount, nameof(total));
        return new SharedPurchase(
            id,
            purchaseMovement,
            card,
            date,
            total,
            string.IsNullOrWhiteSpace(description) ? null : description.Trim(),
            createdAt);
    }

    /// <summary>Asigna una parte, validando que el reparto siga cuadrando.</summary>
    public void Assign(PurchaseShare share)
    {
        Guard.NotNull(share);

        Guard.Require(
            _shares.All(existing => existing.Counterparty != share.Counterparty),
            DomainErrorCodes.ShareDuplicateCounterparty,
            $"La persona {share.Counterparty} ya tiene una parte en esta compra.");

        if (share.FixedAmount is not null)
        {
            Guard.Require(
                share.FixedAmount.Currency == Currency,
                DomainErrorCodes.CurrencyMismatch,
                $"La compra está en {Currency.Code} y la parte en {share.FixedAmount.Currency.Code}.");
        }

        _shares.Add(share);

        try
        {
            _ = Resolve();
        }
        catch
        {
            _shares.Remove(share);
            throw;
        }
    }

    public void Unassign(CounterpartyId counterparty) =>
        _shares.RemoveAll(share => share.Counterparty == counterparty);

    /// <summary>Enlaza la obligación creada para la parte de una persona.</summary>
    public void LinkObligation(CounterpartyId counterparty, ObligationId obligation)
    {
        var index = _shares.FindIndex(share => share.Counterparty == counterparty);
        Guard.Require(
            index >= 0,
            DomainErrorCodes.InvariantViolation,
            $"La persona {counterparty} no tiene parte en esta compra.");

        _shares[index] = _shares[index] with { Obligation = obligation };
    }

    /// <summary>
    /// Resuelve el reparto. Los porcentajes se reparten con
    /// <see cref="Money.Allocate(IReadOnlyList{decimal})"/>, de modo que la suma
    /// de las partes más la porción del titular es exactamente el total: ni un
    /// centavo se pierde ni se inventa.
    /// </summary>
    public PurchaseAllocation Resolve()
    {
        var percentShares = _shares.Where(share => share.Percent is not null).ToList();
        var fixedShares = _shares.Where(share => share.FixedAmount is not null).ToList();

        var percentSum = percentShares.Sum(share => share.Percent!.Value.Percent);
        Guard.Require(
            percentSum <= 100m,
            DomainErrorCodes.ShareExceedsTotal,
            $"Las participaciones porcentuales suman {percentSum} % y no pueden pasar del 100 %.");

        var weights = percentShares.Select(share => share.Percent!.Value.Percent).ToList();
        weights.Add(100m - percentSum);
        var allocated = Total.Allocate(weights);

        var resolved = new List<ResolvedShare>();
        var zero = Money.Zero(Currency);

        for (var i = 0; i < percentShares.Count; i++)
        {
            var naive = Total.Multiply(percentShares[i].Percent!.Value.Rate);
            resolved.Add(new ResolvedShare(percentShares[i], allocated[i], allocated[i] - naive));
        }

        var remainderBlock = allocated[^1];
        var fixedTotal = fixedShares.Aggregate(zero, (total, share) => total + share.FixedAmount!);

        Guard.Require(
            fixedTotal <= remainderBlock,
            DomainErrorCodes.ShareExceedsTotal,
            $"Las partes por importe fijo suman {fixedTotal} y solo quedan {remainderBlock} del total {Total}.");

        foreach (var share in fixedShares)
        {
            resolved.Add(new ResolvedShare(share, share.FixedAmount!, zero));
        }

        var assigned = resolved.Aggregate(zero, (total, share) => total + share.Amount);
        var holder = Total - assigned;

        // La porción del titular jamás es negativa: no se puede asignar más de
        // lo que se financió.
        Guard.Require(
            !holder.IsNegative,
            DomainErrorCodes.ShareExceedsTotal,
            $"Las asignaciones suman {assigned} y superan el total financiado {Total}.");

        var roundingAdjustment = resolved.Aggregate(zero, (total, share) => total + share.RoundingAdjustment);

        return new PurchaseAllocation(resolved, assigned, holder, roundingAdjustment);
    }

    public override string ToString() => $"{Date:yyyy-MM-dd} compra {Total} ({_shares.Count} asignaciones)";
}
