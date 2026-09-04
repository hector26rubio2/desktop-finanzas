namespace Finanzas.Domain.Common;

/// <summary>
/// Códigos estables de error de dominio. Son parte del contrato hacia
/// <c>Finanzas.Contracts</c>: el frontend nunca ve mensajes de SQLite ni de .NET,
/// solo estos códigos y su carga útil.
/// </summary>
public static class DomainErrorCodes
{
    // Genéricos
    public const string InvariantViolation = "domain.invariant_violation";
    public const string RequiredValue = "domain.required_value";
    public const string OutOfRange = "domain.out_of_range";

    // Organizaciones, personas y membresías
    public const string OrganizationInvalidSlug = "organization.invalid_slug";
    public const string UserInvalidEmail = "user.invalid_email";
    public const string MembershipWithoutCapabilities = "membership.without_capabilities";
    public const string MembershipCapabilityMissing = "membership.capability_missing";
    public const string MembershipNotInvited = "membership.not_invited";
    public const string MembershipAlreadySuspended = "membership.already_suspended";
    public const string MembershipNotSuspended = "membership.not_suspended";

    // Dinero y moneda
    public const string InvalidCurrency = "money.invalid_currency";
    public const string CurrencyMismatch = "money.currency_mismatch";
    public const string InvalidAmount = "money.invalid_amount";
    public const string InvalidScale = "money.invalid_scale";
    public const string InvalidExchangeRate = "money.invalid_exchange_rate";
    public const string InvalidPercentage = "money.invalid_percentage";
    public const string InvalidDateRange = "domain.invalid_date_range";

    // Ledger
    public const string MovementAmountNotPositive = "movement.amount_not_positive";
    public const string MovementLinkMissing = "movement.link_missing";
    public const string MovementLinkForbidden = "movement.link_forbidden";
    public const string MovementLinkExclusive = "movement.link_exclusive";
    public const string MovementEffectNotAllowed = "movement.effect_not_allowed";
    public const string MovementFlowNotAllowed = "movement.flow_not_allowed";
    public const string MovementAlreadyReversed = "movement.already_reversed";
    public const string MovementReversalOfReversal = "movement.reversal_of_reversal";
    public const string MovementOriginMismatch = "movement.origin_mismatch";
    public const string OperationUnbalanced = "operation.unbalanced";
    public const string OperationLegMismatch = "operation.leg_mismatch";
    public const string OperationTooFewLegs = "operation.too_few_legs";

    // Tarjetas
    public const string CardLimitExceeded = "card.limit_exceeded";
    public const string CardInvalidCycleDay = "card.invalid_cycle_day";

    // Recurrentes
    public const string RecurrenceInvalidSchedule = "recurrence.invalid_schedule";
    public const string RecurrenceAlreadyMaterialized = "recurrence.already_materialized";
    public const string RecurrenceFinished = "recurrence.finished";
    public const string RecurrenceKindMismatch = "recurrence.kind_mismatch";

    // Inversiones
    public const string PositionInsufficientQuantity = "investment.insufficient_quantity";
    public const string PositionValuationIsNotCashFlow = "investment.valuation_is_not_cash_flow";
    public const string PositionInvalidOperation = "investment.invalid_operation";

    // Obligaciones y abonos
    public const string ObligationClosedPeriod = "obligation.closed_period";
    public const string ObligationNotOpen = "obligation.not_open";
    public const string ObligationOverpayment = "obligation.overpayment_not_allowed";
    public const string ObligationEntryNotFound = "obligation.entry_not_found";
    public const string ObligationEntryAlreadyReversed = "obligation.entry_already_reversed";
    public const string ObligationCannotReverseReversal = "obligation.cannot_reverse_reversal";
    public const string ObligationAllocationMismatch = "obligation.allocation_mismatch";
    public const string ObligationOutstandingNotZero = "obligation.outstanding_not_zero";
    public const string ObligationManualAllocationRequired = "obligation.manual_allocation_required";

    // Compras compartidas
    public const string ShareExceedsTotal = "shared_purchase.exceeds_total";
    public const string ShareDuplicateCounterparty = "shared_purchase.duplicate_counterparty";
    public const string ShareInvalidBasis = "shared_purchase.invalid_basis";

    // Liquidaciones
    public const string SettlementTotalsMismatch = "settlement.totals_mismatch";
    public const string SettlementLineOutOfPeriod = "settlement.line_out_of_period";
}
