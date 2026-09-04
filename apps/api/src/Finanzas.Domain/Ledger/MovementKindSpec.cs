using System.Collections.Frozen;
using Finanzas.Domain.Common;

namespace Finanzas.Domain.Ledger;

/// <summary>
/// Tabla de invariantes por clase de movimiento. Es el corazón del ledger: dice
/// qué efecto económico, qué flujo de caja y qué enlaces admite cada clase.
/// Ninguna de estas reglas vive en un comentario ni en la capa de aplicación;
/// un movimiento imposible no se puede construir.
/// </summary>
public sealed class MovementKindSpec
{
    private static readonly FrozenDictionary<MovementKind, MovementKindSpec> Table = Build();

    private MovementKindSpec(
        MovementKind kind,
        EconomicEffect[] effects,
        CashFlow[] flows,
        MovementLink required,
        MovementLink forbidden,
        MovementLink exactlyOneOf)
    {
        Kind = kind;
        AllowedEffects = effects.ToFrozenSet();
        AllowedFlows = flows.ToFrozenSet();
        Required = required;
        Forbidden = forbidden;
        ExactlyOneOf = exactlyOneOf;

        // Coherencia de la propia tabla: un enlace no puede ser a la vez
        // obligatorio y prohibido.
        Guard.Require(
            (required & forbidden) == MovementLink.None,
            DomainErrorCodes.InvariantViolation,
            $"La especificación de {kind} marca el mismo enlace como obligatorio y prohibido.");

        // Un movimiento que solo admite efecto neutro no puede llevar categoría:
        // categorizarlo lo haría aparecer en reportes de ingreso o gasto y
        // duplicaría el efecto económico (regla financiera 2).
        Guard.Require(
            !IsAlwaysNeutral || forbidden.HasFlag(MovementLink.Category),
            DomainErrorCodes.InvariantViolation,
            $"{kind} es siempre neutro y debe prohibir la categoría.");
    }

    public MovementKind Kind { get; }

    public IReadOnlySet<EconomicEffect> AllowedEffects { get; }

    public IReadOnlySet<CashFlow> AllowedFlows { get; }

    /// <summary>Enlaces que deben estar presentes.</summary>
    public MovementLink Required { get; }

    /// <summary>Enlaces que no pueden estar presentes.</summary>
    public MovementLink Forbidden { get; }

    /// <summary>Grupo del que debe estar presente exactamente un enlace.</summary>
    public MovementLink ExactlyOneOf { get; }

    /// <summary>El movimiento nunca es ingreso ni gasto.</summary>
    public bool IsAlwaysNeutral => AllowedEffects.Count == 1 && AllowedEffects.Contains(EconomicEffect.Neutral);

    public static MovementKindSpec For(MovementKind kind) =>
        Table.TryGetValue(kind, out var spec)
            ? spec
            : throw new InvariantViolationException(
                DomainErrorCodes.InvariantViolation,
                $"No hay especificación registrada para la clase de movimiento {kind}.");

    public static IReadOnlyCollection<MovementKindSpec> All => Table.Values;

    /// <summary>Valida un movimiento candidato contra la especificación.</summary>
    public void Validate(EconomicEffect effect, CashFlow flow, MovementLinks links)
    {
        Guard.NotNull(links);

        Guard.Require(
            AllowedEffects.Contains(effect),
            DomainErrorCodes.MovementEffectNotAllowed,
            $"{Kind} no admite el efecto económico {effect} (admite: {string.Join(", ", AllowedEffects)}).");

        Guard.Require(
            AllowedFlows.Contains(flow),
            DomainErrorCodes.MovementFlowNotAllowed,
            $"{Kind} no admite el flujo de caja {flow} (admite: {string.Join(", ", AllowedFlows)}).");

        var present = links.Present;

        var missing = Required & ~present;
        Guard.Require(
            missing == MovementLink.None,
            DomainErrorCodes.MovementLinkMissing,
            $"{Kind} exige el enlace {missing}.");

        var illegal = Forbidden & present;
        Guard.Require(
            illegal == MovementLink.None,
            DomainErrorCodes.MovementLinkForbidden,
            $"{Kind} no admite el enlace {illegal}.");

        if (ExactlyOneOf != MovementLink.None)
        {
            var chosen = ExactlyOneOf & present;
            Guard.Require(
                int.PopCount((int)chosen) == 1,
                DomainErrorCodes.MovementLinkExclusive,
                $"{Kind} exige exactamente uno de los enlaces {ExactlyOneOf} (presentes: {chosen}).");
        }
    }

    private static FrozenDictionary<MovementKind, MovementKindSpec> Build()
    {
        var neutral = new[] { EconomicEffect.Neutral };
        var income = new[] { EconomicEffect.Income };
        var expense = new[] { EconomicEffect.Expense };

        var specs = new List<MovementKindSpec>
        {
            // --- Ordinarios -------------------------------------------------
            new(
                MovementKind.Income,
                income,
                [CashFlow.Inflow],
                required: MovementLink.Account,
                forbidden: MovementLink.Card | MovementLink.Obligation | MovementLink.Position | MovementLink.SharedPurchase,
                exactlyOneOf: MovementLink.None),
            new(
                MovementKind.Expense,
                expense,
                [CashFlow.Outflow],
                required: MovementLink.Account,
                forbidden: MovementLink.Card | MovementLink.Obligation | MovementLink.Position | MovementLink.SharedPurchase,
                exactlyOneOf: MovementLink.None),

            // --- Transferencias ---------------------------------------------
            // Mover dinero entre cuentas propias jamás es ingreso ni gasto.
            new(
                MovementKind.TransferOut,
                neutral,
                [CashFlow.Outflow],
                required: MovementLink.Account | MovementLink.Operation,
                forbidden: MovementLink.Card | MovementLink.Obligation | MovementLink.Position | MovementLink.Category | MovementLink.SharedPurchase,
                exactlyOneOf: MovementLink.None),
            new(
                MovementKind.TransferIn,
                neutral,
                [CashFlow.Inflow],
                required: MovementLink.Account | MovementLink.Operation,
                forbidden: MovementLink.Card | MovementLink.Obligation | MovementLink.Position | MovementLink.Category | MovementLink.SharedPurchase,
                exactlyOneOf: MovementLink.None),

            // --- Tarjeta de crédito -----------------------------------------
            new(
                MovementKind.CardPurchase,
                expense,
                [CashFlow.Outflow],
                required: MovementLink.Card,
                forbidden: MovementLink.Account | MovementLink.Position,
                exactlyOneOf: MovementLink.None),

            // El pago de tarjeta tiene dos patas (cuenta y tarjeta) unidas por
            // una operación; nunca es gasto: el gasto fue la compra.
            new(
                MovementKind.CardPayment,
                neutral,
                [CashFlow.Inflow, CashFlow.Outflow],
                required: MovementLink.Operation,
                forbidden: MovementLink.Position | MovementLink.Obligation | MovementLink.Category | MovementLink.SharedPurchase,
                exactlyOneOf: MovementLink.Account | MovementLink.Card),
            new(
                MovementKind.CardInterest,
                expense,
                [CashFlow.Outflow, CashFlow.None],
                required: MovementLink.Card,
                forbidden: MovementLink.Account | MovementLink.Position,
                exactlyOneOf: MovementLink.None),
            new(
                MovementKind.CardFee,
                expense,
                [CashFlow.Outflow, CashFlow.None],
                required: MovementLink.Card,
                forbidden: MovementLink.Account | MovementLink.Position,
                exactlyOneOf: MovementLink.None),

            // --- Inversiones -------------------------------------------------
            // Aportar o retirar de una inversión mueve dinero pero no crea ni
            // destruye patrimonio: la valoración va por serie separada.
            new(
                MovementKind.InvestmentContribution,
                neutral,
                [CashFlow.Outflow],
                required: MovementLink.Position,
                forbidden: MovementLink.Card | MovementLink.Obligation | MovementLink.Category | MovementLink.SharedPurchase,
                exactlyOneOf: MovementLink.None),
            new(
                MovementKind.InvestmentWithdrawal,
                neutral,
                [CashFlow.Inflow],
                required: MovementLink.Position,
                forbidden: MovementLink.Card | MovementLink.Obligation | MovementLink.Category | MovementLink.SharedPurchase,
                exactlyOneOf: MovementLink.None),
            new(
                MovementKind.InvestmentBuy,
                neutral,
                [CashFlow.Outflow, CashFlow.None],
                required: MovementLink.Position,
                forbidden: MovementLink.Card | MovementLink.Obligation | MovementLink.Category | MovementLink.SharedPurchase,
                exactlyOneOf: MovementLink.None),
            new(
                MovementKind.InvestmentSell,
                neutral,
                [CashFlow.Inflow, CashFlow.None],
                required: MovementLink.Position,
                forbidden: MovementLink.Card | MovementLink.Obligation | MovementLink.Category | MovementLink.SharedPurchase,
                exactlyOneOf: MovementLink.None),
            new(
                MovementKind.InvestmentDividend,
                income,
                [CashFlow.Inflow, CashFlow.None],
                required: MovementLink.Position,
                forbidden: MovementLink.Card | MovementLink.Obligation | MovementLink.SharedPurchase,
                exactlyOneOf: MovementLink.None),
            new(
                MovementKind.InvestmentFee,
                expense,
                [CashFlow.Outflow, CashFlow.None],
                required: MovementLink.Position,
                forbidden: MovementLink.Card | MovementLink.Obligation | MovementLink.SharedPurchase,
                exactlyOneOf: MovementLink.None),

            // --- Préstamos y obligaciones ------------------------------------
            // Prestar o recibir capital cambia la composición del patrimonio,
            // no el resultado del periodo.
            new(
                MovementKind.LoanDisbursement,
                neutral,
                [CashFlow.Inflow, CashFlow.Outflow],
                required: MovementLink.Obligation | MovementLink.Counterparty,
                forbidden: MovementLink.Position | MovementLink.Category,
                exactlyOneOf: MovementLink.None),

            // Cargo sin desembolso: la compra ya movió el dinero en la tarjeta.
            // No mueve caja y no vuelve a ser gasto (regla financiera 3).
            new(
                MovementKind.LoanCharge,
                neutral,
                [CashFlow.None],
                required: MovementLink.Obligation | MovementLink.Counterparty,
                forbidden: MovementLink.Position | MovementLink.Category,
                exactlyOneOf: MovementLink.None),

            // Interés: devengo (sin caja) o pago explícito. Es el único
            // movimiento de una obligación que puede ser ingreso o gasto.
            new(
                MovementKind.LoanInterest,
                [EconomicEffect.Income, EconomicEffect.Expense, EconomicEffect.Neutral],
                [CashFlow.None, CashFlow.Inflow, CashFlow.Outflow],
                required: MovementLink.Obligation | MovementLink.Counterparty,
                forbidden: MovementLink.Position,
                exactlyOneOf: MovementLink.None),

            // Un abono nunca es gasto ni ingreso: cancela un saldo existente.
            new(
                MovementKind.LoanRepayment,
                neutral,
                [CashFlow.Inflow, CashFlow.Outflow],
                required: MovementLink.Obligation | MovementLink.Counterparty,
                forbidden: MovementLink.Position | MovementLink.Category,
                exactlyOneOf: MovementLink.None),

            // Ajuste documentado (condonación, corrección): sin caja.
            new(
                MovementKind.LoanAdjustment,
                [EconomicEffect.Neutral, EconomicEffect.Income, EconomicEffect.Expense],
                [CashFlow.None],
                required: MovementLink.Obligation | MovementLink.Counterparty,
                forbidden: MovementLink.Position,
                exactlyOneOf: MovementLink.None),
        };

        return specs.ToFrozenDictionary(spec => spec.Kind);
    }
}
