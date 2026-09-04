using Finanzas.Contracts.Common;
using Finanzas.Contracts.Ledger;
using Finanzas.Contracts.Obligations;

namespace Finanzas.Contracts.Settlements;

/// <summary>Entrada usada en la liquidación, con su origen trazable.</summary>
/// <param name="Obligation">Obligación de la que sale.</param>
/// <param name="Entry">Entrada exacta utilizada.</param>
/// <param name="Type">Clase de entrada.</param>
/// <param name="Date">Fecha de la entrada.</param>
/// <param name="PrincipalDelta">Efecto firmado sobre el capital.</param>
/// <param name="InterestDelta">Efecto firmado sobre los intereses.</param>
public sealed record SettlementLineDto(
    Guid Obligation,
    Guid Entry,
    ObligationEntryTypeDto Type,
    DateOnly Date,
    MoneyDto PrincipalDelta,
    MoneyDto InterestDelta);

/// <summary>Liquidación por persona y periodo.</summary>
/// <remarks>
/// <para><b>Es inmutable</b> (regla financiera 9). Conserva la versión de fórmula,
/// la fecha de corte y las entradas exactas con las que se calculó. Recalcular
/// con otras reglas produce una liquidación nueva; la emitida no cambia, porque
/// es el documento que se le mostró a una persona.</para>
/// <para>Emitirla no genera ingreso ni gasto: es un informe, no un hecho
/// económico (regla financiera 2).</para>
/// </remarks>
/// <param name="Id">Identificador de la liquidación.</param>
/// <param name="Counterparty">Persona liquidada.</param>
/// <param name="Period">Periodo cubierto.</param>
/// <param name="CutOff">Fecha de corte.</param>
/// <param name="Currency">Moneda de la liquidación.</param>
/// <param name="OpeningBalance">Saldo al iniciar el periodo.</param>
/// <param name="Charges">Cargos del periodo.</param>
/// <param name="Interest">Intereses del periodo.</param>
/// <param name="Payments">Abonos del periodo.</param>
/// <param name="Adjustments">Ajustes del periodo.</param>
/// <param name="ClosingBalance">Saldo al cierre.</param>
/// <param name="FormulaVersion">Versión de la fórmula con la que se calculó.</param>
/// <param name="Lines">Entradas exactas utilizadas.</param>
/// <param name="IssuedAt">Instante de emisión.</param>
public sealed record SettlementDto(
    Guid Id,
    LinkRefDto Counterparty,
    DateRangeDto Period,
    DateOnly CutOff,
    string Currency,
    MoneyDto OpeningBalance,
    MoneyDto Charges,
    MoneyDto Interest,
    MoneyDto Payments,
    MoneyDto Adjustments,
    MoneyDto ClosingBalance,
    int FormulaVersion,
    IReadOnlyList<SettlementLineDto> Lines,
    DateTimeOffset IssuedAt);

/// <summary>Emisión de una liquidación.</summary>
/// <remarks>
/// El servidor recoge las entradas del periodo y fija la versión de fórmula
/// vigente. Emitir dos veces el mismo periodo produce dos liquidaciones
/// distintas y ambas se conservan: cuál se le entregó a la persona es parte de
/// la auditoría.
/// </remarks>
/// <param name="Counterparty">Persona a liquidar.</param>
/// <param name="Period">Periodo a cubrir.</param>
/// <param name="CutOff">Fecha de corte.</param>
/// <param name="Currency">Código ISO de la moneda.</param>
public sealed record IssueSettlementRequest(
    Guid Counterparty,
    DateRangeDto Period,
    DateOnly CutOff,
    string Currency);
