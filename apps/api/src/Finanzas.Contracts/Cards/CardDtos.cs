using Finanzas.Contracts.Common;
using Finanzas.Contracts.Ledger;

namespace Finanzas.Contracts.Cards;

/// <summary>Ciclo de facturación: día de corte y día de pago.</summary>
/// <param name="StatementDay">Día del mes en que corta el extracto.</param>
/// <param name="PaymentDueDay">Día del mes en que vence el pago.</param>
public sealed record BillingCycleDto(int StatementDay, int PaymentDueDay);

/// <summary>Un periodo concreto del ciclo, con sus fechas ya resueltas.</summary>
/// <remarks>
/// El servidor resuelve los meses cortos: un corte el día 31 cae el 28 o el 29
/// de febrero. El cliente no repite ese cálculo.
/// </remarks>
/// <param name="Range">Días que cubre el periodo, inclusive por ambos extremos.</param>
/// <param name="StatementDate">Fecha de corte del extracto.</param>
/// <param name="DueDate">Fecha límite de pago.</param>
public sealed record BillingPeriodDto(DateRangeDto Range, DateOnly StatementDate, DateOnly DueDate);

/// <summary>Condiciones financieras de la tarjeta.</summary>
/// <remarks>
/// Las tasas viajan como texto en tanto por uno, igual que el resto de los
/// decimales del contrato.
/// </remarks>
/// <param name="PurchaseApr">Tasa anual de compras.</param>
/// <param name="CashAdvanceApr">Tasa anual de avances en efectivo.</param>
/// <param name="InternationalPurchaseApr">Tasa anual de compras internacionales.</param>
/// <param name="DeferredDefaultApr">Tasa anual por omisión de las compras diferidas.</param>
/// <param name="MinimumPaymentRate">Porcentaje del extracto que exige el pago mínimo.</param>
/// <param name="MinimumPaymentFloor">Piso del pago mínimo, si el emisor lo impone.</param>
/// <param name="GracePeriodDays">Días de gracia entre el corte y el vencimiento.</param>
public sealed record CardTermsDto(
    PercentageDto PurchaseApr,
    PercentageDto CashAdvanceApr,
    PercentageDto InternationalPurchaseApr,
    PercentageDto DeferredDefaultApr,
    PercentageDto MinimumPaymentRate,
    MoneyDto? MinimumPaymentFloor,
    int GracePeriodDays);

/// <summary>Tarjeta de crédito.</summary>
/// <remarks>
/// No es una cuenta: no tiene saldo propio sino deuda con el emisor. Su
/// situación en una fecha se consulta con <see cref="CardStatusDto"/>, que se
/// calcula sobre el ledger.
/// </remarks>
/// <param name="Id">Identificador de la tarjeta.</param>
/// <param name="Name">Nombre visible.</param>
/// <param name="Currency">Moneda de la tarjeta.</param>
/// <param name="CreditLimit">Cupo total aprobado.</param>
/// <param name="Cycle">Ciclo de facturación.</param>
/// <param name="Terms">Condiciones financieras.</param>
/// <param name="Issuer">Entidad emisora.</param>
/// <param name="LastFour">Últimos cuatro dígitos.</param>
/// <param name="IsActive">Sigue en uso.</param>
/// <param name="CreatedAt">Instante de creación.</param>
public sealed record CreditCardDto(
    Guid Id,
    string Name,
    string Currency,
    MoneyDto CreditLimit,
    BillingCycleDto Cycle,
    CardTermsDto Terms,
    string? Issuer,
    string? LastFour,
    bool IsActive,
    DateTimeOffset CreatedAt);

/// <summary>Situación de una tarjeta a una fecha, calculada sobre el ledger.</summary>
/// <remarks>
/// <para><see cref="Debt"/> es lo que se debe al emisor: compras, intereses y
/// cuotas menos los pagos. No descuenta lo que otras personas deban por compras
/// asignadas, porque esa cuenta por cobrar es otra cosa (regla financiera 3);
/// se consulta en <c>DebtPositionDto</c>.</para>
/// <para><see cref="MinimumPayment"/> es el mínimo del extracto vigente, no una
/// recomendación de cuánto pagar.</para>
/// </remarks>
/// <param name="Card">Tarjeta a la que corresponde la situación.</param>
/// <param name="Debt">Deuda con el emisor a la fecha.</param>
/// <param name="AvailableCredit">Cupo disponible: límite menos deuda, nunca negativo.</param>
/// <param name="Utilization">Porcentaje del cupo usado.</param>
/// <param name="CurrentPeriod">Periodo de facturación que contiene la fecha.</param>
/// <param name="MinimumPayment">Pago mínimo exigible sobre la deuda actual.</param>
/// <param name="AsOf">Fecha hasta la que se acumularon los movimientos.</param>
public sealed record CardStatusDto(
    LinkRefDto Card,
    MoneyDto Debt,
    MoneyDto AvailableCredit,
    PercentageDto Utilization,
    BillingPeriodDto CurrentPeriod,
    MoneyDto MinimumPayment,
    DateOnly AsOf);

/// <summary>Alta de una tarjeta.</summary>
/// <param name="Name">Nombre visible.</param>
/// <param name="Currency">Código ISO de la moneda.</param>
/// <param name="CreditLimit">Cupo total aprobado.</param>
/// <param name="Cycle">Ciclo de facturación.</param>
/// <param name="Terms">Condiciones financieras.</param>
/// <param name="Issuer">Entidad emisora.</param>
/// <param name="LastFour">Últimos cuatro dígitos.</param>
public sealed record CreateCreditCardRequest(
    string Name,
    string Currency,
    MoneyDto CreditLimit,
    BillingCycleDto Cycle,
    CardTermsDto Terms,
    string? Issuer = null,
    string? LastFour = null);

/// <summary>Edición de una tarjeta.</summary>
/// <remarks>
/// Cambiar el cupo, el ciclo o las tasas rige de aquí en adelante: no recalcula
/// los extractos ya cerrados (regla financiera 8).
/// </remarks>
/// <param name="Name">Nombre visible.</param>
/// <param name="CreditLimit">Cupo total aprobado.</param>
/// <param name="Cycle">Ciclo de facturación.</param>
/// <param name="Terms">Condiciones financieras.</param>
/// <param name="Issuer">Entidad emisora.</param>
/// <param name="LastFour">Últimos cuatro dígitos.</param>
/// <param name="IsActive">Activa o archivada.</param>
public sealed record UpdateCreditCardRequest(
    string Name,
    MoneyDto CreditLimit,
    BillingCycleDto Cycle,
    CardTermsDto Terms,
    string? Issuer,
    string? LastFour,
    bool IsActive);
