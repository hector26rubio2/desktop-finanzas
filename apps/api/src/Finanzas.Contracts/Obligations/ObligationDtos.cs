using Finanzas.Contracts.Common;
using Finanzas.Contracts.Ledger;

namespace Finanzas.Contracts.Obligations;

/// <summary>
/// Hacia dónde apunta la obligación. Espejo de
/// <c>Finanzas.Domain.Obligations.ObligationDirection</c>.
/// </summary>
public enum ObligationDirectionDto
{
    /// <summary>Alguien debe al titular.</summary>
    Receivable = 1,

    /// <summary>El titular debe a alguien.</summary>
    Payable = 2,
}

/// <summary>
/// De dónde nació la obligación. Espejo de
/// <c>Finanzas.Domain.Obligations.ObligationOrigin</c>.
/// </summary>
public enum ObligationOriginDto
{
    CardPurchase = 1,
    DirectLoan = 2,
    Adjustment = 3,
}

/// <summary>
/// Estado de la obligación. Espejo de
/// <c>Finanzas.Domain.Obligations.ObligationStatus</c>.
/// </summary>
public enum ObligationStatusDto
{
    Open = 1,
    Settled = 2,
    Cancelled = 3,
}

/// <summary>
/// Clase de entrada del historial. Espejo de
/// <c>Finanzas.Domain.Obligations.ObligationEntryType</c>.
/// </summary>
/// <remarks>
/// <see cref="Closure"/> es la entrada con la que se da por saldada una
/// obligación: importe cero y sin movimiento asociado, porque saldar no es un
/// hecho económico nuevo (regla financiera 2).
/// </remarks>
public enum ObligationEntryTypeDto
{
    Disbursement = 1,
    Charge = 2,
    Interest = 3,
    Payment = 4,
    Adjustment = 5,
    Reversal = 6,
    Closure = 7,
}

/// <summary>
/// Orden en que un abono consume el saldo. Espejo de
/// <c>Finanzas.Domain.Obligations.PaymentAllocationRule</c>.
/// </summary>
public enum PaymentAllocationRuleDto
{
    PrincipalFirst = 1,
    InterestFirst = 2,
    Proportional = 3,

    /// <summary>El importe de capital e interés lo decide quien registra el abono.</summary>
    Manual = 4,
}

/// <summary>
/// Forma de causar intereses. Espejo de
/// <c>Finanzas.Domain.Obligations.InterestPolicyKind</c>.
/// </summary>
public enum InterestPolicyKindDto
{
    None = 0,
    FixedRate = 1,
    PeriodicRate = 2,
    InheritedFromCard = 3,
}

/// <summary>
/// Periodo al que está expresada una tasa. Espejo de
/// <c>Finanzas.Domain.Obligations.RatePeriod</c>.
/// </summary>
public enum RatePeriodDto
{
    Annual = 1,
    Monthly = 2,
    Daily = 3,
}

/// <summary>Política de interés de una obligación.</summary>
/// <param name="Kind">Forma de causar intereses.</param>
/// <param name="Rate">Tasa en tanto por uno.</param>
/// <param name="Period">Periodo al que está expresada la tasa.</param>
public sealed record InterestPolicyDto(
    InterestPolicyKindDto Kind,
    PercentageDto Rate,
    RatePeriodDto Period);

/// <summary>Política vigente desde una fecha.</summary>
/// <remarks>
/// El historial se conserva completo: cambiar la tasa hoy no recalcula el
/// interés ya causado (regla financiera 8).
/// </remarks>
/// <param name="EffectiveFrom">Primer día en que rige.</param>
/// <param name="Policy">Política que rige desde esa fecha.</param>
public sealed record InterestPolicyTermDto(DateOnly EffectiveFrom, InterestPolicyDto Policy);

/// <summary>Entrada del historial de una obligación.</summary>
/// <remarks>
/// <para>Los deltas están firmados: un cargo suma capital, un abono lo resta. El
/// saldo es la suma de las entradas, no un campo que alguien edita (regla
/// financiera 1).</para>
/// <para><see cref="Movement"/> es nulo cuando la entrada no mueve dinero: un
/// devengo de interés, un ajuste documentado o el cierre.</para>
/// </remarks>
/// <param name="Id">Identificador de la entrada.</param>
/// <param name="Type">Clase de entrada.</param>
/// <param name="Date">Fecha de la entrada.</param>
/// <param name="PrincipalDelta">Efecto firmado sobre el capital.</param>
/// <param name="InterestDelta">Efecto firmado sobre los intereses.</param>
/// <param name="Movement">Movimiento del ledger que la respalda, si lo hay.</param>
/// <param name="ReversalOf">Entrada que esta reversa, si es un reverso.</param>
/// <param name="ReversedBy">Reverso que anuló esta entrada, si lo hay.</param>
/// <param name="Note">Nota libre.</param>
/// <param name="CreatedAt">Instante de creación.</param>
public sealed record ObligationEntryDto(
    Guid Id,
    ObligationEntryTypeDto Type,
    DateOnly Date,
    MoneyDto PrincipalDelta,
    MoneyDto InterestDelta,
    Guid? Movement,
    Guid? ReversalOf,
    Guid? ReversedBy,
    string? Note,
    DateTimeOffset CreatedAt);

/// <summary>Cómo se repartió un abono.</summary>
/// <remarks>
/// <see cref="Excess"/> es lo que sobró al cubrir capital e intereses. Solo
/// aparece si la obligación admite sobrepago; si no, el abono se rechaza en vez
/// de dejar un saldo negativo.
/// </remarks>
/// <param name="Principal">Parte aplicada a capital.</param>
/// <param name="Interest">Parte aplicada a intereses.</param>
/// <param name="Excess">Excedente sobre el saldo pendiente.</param>
public sealed record PaymentAllocationDto(MoneyDto Principal, MoneyDto Interest, MoneyDto Excess);

/// <summary>Obligación: un préstamo, un cobro pendiente o un cargo asignado.</summary>
/// <remarks>
/// Los saldos son proyecciones de <see cref="Entries"/>. Un abono no reescribe
/// el importe original y reversar una entrada restaura el saldo sin borrar la
/// auditoría (regla financiera 6).
/// </remarks>
/// <param name="Id">Identificador de la obligación.</param>
/// <param name="Counterparty">Persona con la que existe.</param>
/// <param name="Direction">Si el titular debe o le deben.</param>
/// <param name="Origin">De dónde nació.</param>
/// <param name="Currency">Moneda en la que se lleva.</param>
/// <param name="OpenedOn">Fecha de apertura.</param>
/// <param name="DueOn">Fecha de vencimiento, si se pactó.</param>
/// <param name="AllocationRule">Orden en que los abonos consumen el saldo.</param>
/// <param name="AllowsOverpayment">Admite abonos por encima del saldo.</param>
/// <param name="Card">Tarjeta de origen, si nació de una compra.</param>
/// <param name="Account">Cuenta de origen, si nació de un desembolso.</param>
/// <param name="Description">Descripción libre.</param>
/// <param name="Status">Estado actual.</param>
/// <param name="ClosedThrough">Fecha hasta la que está cerrada y no admite entradas nuevas.</param>
/// <param name="PrincipalOutstanding">Capital pendiente.</param>
/// <param name="InterestOutstanding">Intereses pendientes.</param>
/// <param name="TotalOutstanding">Suma de los dos anteriores.</param>
/// <param name="InterestPolicies">Historial de políticas de interés.</param>
/// <param name="Entries">Historial completo, incluidos los reversos.</param>
/// <param name="CreatedAt">Instante de creación.</param>
public sealed record ObligationDto(
    Guid Id,
    LinkRefDto Counterparty,
    ObligationDirectionDto Direction,
    ObligationOriginDto Origin,
    string Currency,
    DateOnly OpenedOn,
    DateOnly? DueOn,
    PaymentAllocationRuleDto AllocationRule,
    bool AllowsOverpayment,
    Guid? Card,
    Guid? Account,
    string? Description,
    ObligationStatusDto Status,
    DateOnly? ClosedThrough,
    MoneyDto PrincipalOutstanding,
    MoneyDto InterestOutstanding,
    MoneyDto TotalOutstanding,
    IReadOnlyList<InterestPolicyTermDto> InterestPolicies,
    IReadOnlyList<ObligationEntryDto> Entries,
    DateTimeOffset CreatedAt);

/// <summary>Alta de una obligación.</summary>
/// <remarks>
/// Crear la obligación no genera ingreso ni gasto: el efecto económico llega con
/// el desembolso o el cargo (regla financiera 2).
/// </remarks>
/// <param name="Counterparty">Persona con la que existe.</param>
/// <param name="Direction">Si el titular debe o le deben.</param>
/// <param name="Origin">De dónde nace.</param>
/// <param name="Currency">Código ISO de la moneda.</param>
/// <param name="OpenedOn">Fecha de apertura.</param>
/// <param name="AllocationRule">Orden en que los abonos consumen el saldo.</param>
/// <param name="InterestPolicy">Política de interés inicial. Nulo es sin intereses.</param>
/// <param name="DueOn">Fecha de vencimiento pactada.</param>
/// <param name="AllowsOverpayment">Admite abonos por encima del saldo.</param>
/// <param name="Card">Tarjeta de origen. Obligatoria si el origen es una compra.</param>
/// <param name="Account">Cuenta de origen, si aplica.</param>
/// <param name="Description">Descripción libre.</param>
public sealed record CreateObligationRequest(
    Guid Counterparty,
    ObligationDirectionDto Direction,
    ObligationOriginDto Origin,
    string Currency,
    DateOnly OpenedOn,
    PaymentAllocationRuleDto AllocationRule = PaymentAllocationRuleDto.InterestFirst,
    InterestPolicyDto? InterestPolicy = null,
    DateOnly? DueOn = null,
    bool AllowsOverpayment = false,
    Guid? Card = null,
    Guid? Account = null,
    string? Description = null);

/// <summary>Desembolso de capital: mueve dinero y abre el saldo.</summary>
/// <param name="Date">Fecha del desembolso.</param>
/// <param name="Amount">Capital desembolsado.</param>
/// <param name="Account">Cuenta por la que entra o sale el dinero.</param>
/// <param name="Note">Nota libre.</param>
/// <param name="IdempotencyKey">Clave para reintentar sin duplicar.</param>
public sealed record RegisterDisbursementRequest(
    DateOnly Date,
    MoneyDto Amount,
    Guid Account,
    string? Note = null,
    string? IdempotencyKey = null);

/// <summary>Cargo sin desembolso: la compra ya movió el dinero en la tarjeta.</summary>
/// <remarks>
/// No mueve caja y no vuelve a ser gasto: contarlo otra vez duplicaría el efecto
/// de la compra original (reglas financieras 2 y 3).
/// </remarks>
/// <param name="Date">Fecha del cargo.</param>
/// <param name="Amount">Importe cargado.</param>
/// <param name="SharedPurchase">Compra compartida que lo origina, si viene de una.</param>
/// <param name="Note">Nota libre.</param>
/// <param name="IdempotencyKey">Clave para reintentar sin duplicar.</param>
public sealed record RegisterChargeRequest(
    DateOnly Date,
    MoneyDto Amount,
    Guid? SharedPurchase = null,
    string? Note = null,
    string? IdempotencyKey = null);

/// <summary>Abono a una obligación.</summary>
/// <remarks>
/// <para>El abono no es gasto ni ingreso: cancela un saldo existente. Un pago con
/// intereses produce <b>dos</b> movimientos —capital neutro e interés gasto—,
/// no uno mezclado (decisión de <c>HANDOFF.md</c> §1).</para>
/// <para>Con la regla <see cref="PaymentAllocationRuleDto.Manual"/> hay que
/// enviar <see cref="Principal"/> e <see cref="Interest"/>; con cualquier otra,
/// el reparto lo calcula el servidor y enviarlos es un error.</para>
/// </remarks>
/// <param name="Date">Fecha del abono.</param>
/// <param name="Amount">Importe total abonado.</param>
/// <param name="Account">Cuenta por la que se paga o se cobra.</param>
/// <param name="Principal">Parte a capital, solo con reparto manual.</param>
/// <param name="Interest">Parte a intereses, solo con reparto manual.</param>
/// <param name="Note">Nota libre.</param>
/// <param name="IdempotencyKey">Clave para reintentar sin duplicar.</param>
public sealed record RegisterPaymentRequest(
    DateOnly Date,
    MoneyDto Amount,
    Guid Account,
    MoneyDto? Principal = null,
    MoneyDto? Interest = null,
    string? Note = null,
    string? IdempotencyKey = null);

/// <summary>Interés de la obligación: devengo o pago explícito.</summary>
/// <param name="Date">Fecha del interés.</param>
/// <param name="Amount">Importe del interés.</param>
/// <param name="Account">Cuenta, si se paga en el acto. Nulo si solo se causa.</param>
/// <param name="Note">Nota libre.</param>
/// <param name="IdempotencyKey">Clave para reintentar sin duplicar.</param>
public sealed record RegisterInterestRequest(
    DateOnly Date,
    MoneyDto Amount,
    Guid? Account = null,
    string? Note = null,
    string? IdempotencyKey = null);

/// <summary>Ajuste documentado del saldo: condonación o corrección.</summary>
/// <remarks>No mueve caja y exige nota: un ajuste sin explicación es un saldo sin auditoría.</remarks>
/// <param name="Date">Fecha del ajuste.</param>
/// <param name="PrincipalDelta">Efecto firmado sobre el capital.</param>
/// <param name="InterestDelta">Efecto firmado sobre los intereses.</param>
/// <param name="Note">Motivo del ajuste.</param>
public sealed record RegisterAdjustmentRequest(
    DateOnly Date,
    MoneyDto PrincipalDelta,
    MoneyDto InterestDelta,
    string Note);

/// <summary>Cambio de la política de interés a partir de una fecha.</summary>
/// <remarks>No recalcula el interés ya causado (regla financiera 8).</remarks>
/// <param name="Policy">Política nueva.</param>
/// <param name="EffectiveFrom">Primer día en que rige.</param>
public sealed record ChangeInterestPolicyRequest(InterestPolicyDto Policy, DateOnly EffectiveFrom);

/// <summary>Reverso de una entrada del historial.</summary>
/// <remarks>Restaura el saldo sin borrar la entrada original (regla financiera 6).</remarks>
/// <param name="Entry">Entrada que se reversa.</param>
/// <param name="Date">Fecha del reverso.</param>
/// <param name="Reason">Motivo.</param>
public sealed record ReverseObligationEntryRequest(Guid Entry, DateOnly Date, string? Reason = null);

/// <summary>Cierre de la obligación: se da por saldada.</summary>
/// <remarks>
/// Produce una entrada <see cref="ObligationEntryTypeDto.Closure"/> de importe
/// cero y sin movimiento. Marcar saldado no genera ingreso ni gasto (regla
/// financiera 2).
/// </remarks>
/// <param name="Date">Fecha del cierre.</param>
/// <param name="Note">Nota libre.</param>
public sealed record SettleObligationRequest(DateOnly Date, string? Note = null);
