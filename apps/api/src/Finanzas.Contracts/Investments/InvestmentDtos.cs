using Finanzas.Contracts.Common;

namespace Finanzas.Contracts.Investments;

/// <summary>
/// Riesgo declarado de la posición. Espejo de
/// <c>Finanzas.Domain.Investments.RiskLevel</c>.
/// </summary>
public enum RiskLevelDto
{
    Low = 1,
    Medium = 2,
    High = 3,
}

/// <summary>
/// Clase de operación sobre la posición. Espejo de
/// <c>Finanzas.Domain.Investments.InvestmentOperationType</c>.
/// </summary>
/// <remarks>
/// Aportar y retirar mueven dinero pero no crean ni destruyen patrimonio: el
/// resultado aparece por valoración, no por el aporte. Solo el dividendo es
/// ingreso y solo la comisión es gasto.
/// </remarks>
public enum InvestmentOperationTypeDto
{
    Contribution = 1,
    Withdrawal = 2,
    Buy = 3,
    Sell = 4,
    Dividend = 5,
    Fee = 6,
}

/// <summary>
/// De dónde salió una valoración. Espejo de
/// <c>Finanzas.Domain.Investments.ValuationSource</c>.
/// </summary>
public enum ValuationSourceDto
{
    MarketPrice = 1,
    Statement = 2,
    Manual = 3,
}

/// <summary>Valor de la posición en una fecha.</summary>
/// <remarks>
/// La serie de valoraciones es independiente de las operaciones: el precio sube
/// sin que nadie compre ni venda. Mezclarlas convertiría una revalorización en
/// un ingreso inexistente.
/// </remarks>
/// <param name="Id">Identificador de la valoración.</param>
/// <param name="Date">Fecha a la que corresponde el valor.</param>
/// <param name="Value">Valor de mercado de la posición completa.</param>
/// <param name="Source">De dónde salió la cifra.</param>
/// <param name="Reference">Referencia del extracto o de la fuente de precio.</param>
public sealed record ValuationDto(
    Guid Id,
    DateOnly Date,
    MoneyDto Value,
    ValuationSourceDto Source,
    string? Reference);

/// <summary>Operación registrada sobre la posición.</summary>
/// <param name="Movement">Movimiento del ledger que la respalda.</param>
/// <param name="Type">Clase de operación.</param>
/// <param name="Date">Fecha de la operación.</param>
/// <param name="Amount">Importe en dinero.</param>
/// <param name="Quantity">Unidades, en compras y ventas.</param>
/// <param name="UnitPrice">Precio unitario, en compras y ventas.</param>
public sealed record InvestmentOperationDto(
    Guid Movement,
    InvestmentOperationTypeDto Type,
    DateOnly Date,
    MoneyDto Amount,
    string? Quantity,
    MoneyDto? UnitPrice);

/// <summary>Posición de inversión.</summary>
/// <remarks>
/// <para><see cref="MarketValue"/> y <see cref="UnrealizedGain"/> son nulos
/// mientras no haya valoración a la fecha consultada. Nulo significa "no se
/// sabe" y la interfaz debe decirlo: sustituirlo por el costo haría parecer que
/// la posición no ha ganado ni perdido nada.</para>
/// <para>Las cantidades viajan como texto por la misma razón que el dinero: son
/// decimales y un <c>number</c> JSON los redondea.</para>
/// </remarks>
/// <param name="Id">Identificador de la posición.</param>
/// <param name="Name">Nombre visible.</param>
/// <param name="InstrumentType">Tipo de instrumento, en texto libre.</param>
/// <param name="Currency">Moneda de la posición.</param>
/// <param name="Risk">Riesgo declarado.</param>
/// <param name="Symbol">Símbolo o nemotécnico.</param>
/// <param name="Institution">Entidad donde está la posición.</param>
/// <param name="Quantity">Unidades en poder, como texto decimal.</param>
/// <param name="CostBasis">Costo de lo que se conserva.</param>
/// <param name="NetContributions">Aportes menos retiros.</param>
/// <param name="MarketValue">Valor de mercado a la fecha, si hay valoración.</param>
/// <param name="UnrealizedGain">Valor de mercado menos costo, si hay valoración.</param>
/// <param name="LatestValuation">Última valoración disponible a la fecha.</param>
/// <param name="IsActive">Sigue en uso.</param>
/// <param name="AsOf">Fecha a la que se calcularon las cifras.</param>
/// <param name="CreatedAt">Instante de creación.</param>
public sealed record InvestmentPositionDto(
    Guid Id,
    string Name,
    string InstrumentType,
    string Currency,
    RiskLevelDto Risk,
    string? Symbol,
    string? Institution,
    string Quantity,
    MoneyDto CostBasis,
    MoneyDto NetContributions,
    MoneyDto? MarketValue,
    MoneyDto? UnrealizedGain,
    ValuationDto? LatestValuation,
    bool IsActive,
    DateOnly AsOf,
    DateTimeOffset CreatedAt);

/// <summary>Alta de una posición de inversión.</summary>
/// <param name="Name">Nombre visible.</param>
/// <param name="InstrumentType">Tipo de instrumento.</param>
/// <param name="Currency">Código ISO de la moneda.</param>
/// <param name="Risk">Riesgo declarado.</param>
/// <param name="Symbol">Símbolo o nemotécnico.</param>
/// <param name="Institution">Entidad donde está la posición.</param>
public sealed record CreateInvestmentPositionRequest(
    string Name,
    string InstrumentType,
    string Currency,
    RiskLevelDto Risk,
    string? Symbol = null,
    string? Institution = null);

/// <summary>Edición de una posición.</summary>
/// <param name="Name">Nombre visible.</param>
/// <param name="InstrumentType">Tipo de instrumento.</param>
/// <param name="Risk">Riesgo declarado.</param>
/// <param name="Symbol">Símbolo o nemotécnico.</param>
/// <param name="IsActive">Activa o archivada.</param>
public sealed record UpdateInvestmentPositionRequest(
    string Name,
    string InstrumentType,
    RiskLevelDto Risk,
    string? Symbol,
    bool IsActive);

/// <summary>Registro de una operación sobre la posición.</summary>
/// <remarks>
/// <see cref="Account"/> es obligatoria cuando la operación mueve dinero contra
/// una cuenta propia —aporte, retiro, dividendo cobrado— y se omite cuando el
/// movimiento ocurre dentro de la posición.
/// </remarks>
/// <param name="Type">Clase de operación.</param>
/// <param name="Date">Fecha de la operación.</param>
/// <param name="Amount">Importe en dinero.</param>
/// <param name="Account">Cuenta contra la que se mueve el dinero, si aplica.</param>
/// <param name="Quantity">Unidades, como texto decimal.</param>
/// <param name="UnitPrice">Precio unitario.</param>
/// <param name="Description">Descripción libre.</param>
/// <param name="IdempotencyKey">Clave para reintentar sin duplicar.</param>
public sealed record RegisterInvestmentOperationRequest(
    InvestmentOperationTypeDto Type,
    DateOnly Date,
    MoneyDto Amount,
    Guid? Account = null,
    string? Quantity = null,
    MoneyDto? UnitPrice = null,
    string? Description = null,
    string? IdempotencyKey = null);

/// <summary>Registro de una valoración.</summary>
/// <param name="Date">Fecha a la que corresponde el valor.</param>
/// <param name="Value">Valor de mercado de la posición completa.</param>
/// <param name="Source">De dónde salió la cifra.</param>
/// <param name="Reference">Referencia del extracto o de la fuente.</param>
public sealed record AddValuationRequest(
    DateOnly Date,
    MoneyDto Value,
    ValuationSourceDto Source,
    string? Reference = null);

/// <summary>Resumen del patrimonio invertido a una fecha.</summary>
/// <remarks>
/// <see cref="MarketValue"/> solo suma las posiciones con valoración vigente;
/// <see cref="PositionsWithoutValuation"/> dice cuántas quedaron fuera, para que
/// la interfaz no presente un total incompleto como si fuera el patrimonio real.
/// </remarks>
/// <param name="CostBasis">Costo total de lo que se conserva.</param>
/// <param name="MarketValue">Valor de mercado de las posiciones valoradas.</param>
/// <param name="UnrealizedGain">Diferencia entre ambos.</param>
/// <param name="PositionsWithoutValuation">Posiciones sin valoración a la fecha.</param>
/// <param name="AsOf">Fecha del corte.</param>
public sealed record PortfolioSummaryDto(
    MoneyDto CostBasis,
    MoneyDto MarketValue,
    MoneyDto UnrealizedGain,
    int PositionsWithoutValuation,
    DateOnly AsOf);
