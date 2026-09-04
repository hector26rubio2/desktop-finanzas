namespace Finanzas.Domain.Ledger;

/// <summary>
/// Clase de un movimiento: <b>qué</b> es la fila del ledger. Sustituye a las
/// cinco columnas dispersas del esquema heredado (<c>type</c>, <c>sub_type</c>,
/// <c>source_type</c>, <c>operation_type</c>,
/// <c>investment_transaction_type</c>) por un único discriminador.
/// </summary>
public enum MovementKind
{
    /// <summary>Ingreso ordinario.</summary>
    Income = 1,

    /// <summary>Gasto ordinario.</summary>
    Expense = 2,

    /// <summary>Pata de salida de una transferencia entre cuentas propias.</summary>
    TransferOut = 10,

    /// <summary>Pata de entrada de una transferencia entre cuentas propias.</summary>
    TransferIn = 11,

    /// <summary>Compra con tarjeta de crédito: aumenta la deuda con el emisor.</summary>
    CardPurchase = 20,

    /// <summary>Pago a la tarjeta: mueve dinero de una cuenta a la tarjeta, no es gasto.</summary>
    CardPayment = 21,

    /// <summary>Interés causado por la tarjeta.</summary>
    CardInterest = 22,

    /// <summary>Cuota de manejo, seguro o comisión de la tarjeta.</summary>
    CardFee = 23,

    /// <summary>Aporte de efectivo a una posición de inversión.</summary>
    InvestmentContribution = 30,

    /// <summary>Retiro de efectivo de una posición de inversión.</summary>
    InvestmentWithdrawal = 31,

    /// <summary>Compra de un instrumento dentro de la posición.</summary>
    InvestmentBuy = 32,

    /// <summary>Venta de un instrumento dentro de la posición.</summary>
    InvestmentSell = 33,

    /// <summary>Dividendo o rendimiento distribuido.</summary>
    InvestmentDividend = 34,

    /// <summary>Comisión del intermediario o del fondo.</summary>
    InvestmentFee = 35,

    /// <summary>Desembolso de un préstamo (dado o recibido): mueve el capital.</summary>
    LoanDisbursement = 40,

    /// <summary>Cargo a una obligación sin desembolso directo (p. ej. compra asignada a una persona).</summary>
    LoanCharge = 41,

    /// <summary>Interés de la obligación: devengo o pago explícito.</summary>
    LoanInterest = 42,

    /// <summary>Abono a una obligación.</summary>
    LoanRepayment = 43,

    /// <summary>Ajuste documentado del saldo de una obligación.</summary>
    LoanAdjustment = 44,
}

/// <summary>
/// Efecto económico del movimiento sobre el resultado del periodo. Separado del
/// flujo de caja a propósito: un pago de tarjeta mueve dinero pero no es gasto,
/// y un devengo de interés es gasto sin mover dinero. Es la codificación de la
/// regla financiera 2: el efecto económico se registra una sola vez.
/// </summary>
public enum EconomicEffect
{
    /// <summary>Ni ingreso ni gasto: traslado de valor entre patrimonios propios.</summary>
    Neutral = 0,

    Income = 1,

    Expense = 2,
}

/// <summary>
/// Efecto sobre el saldo del instrumento afectado (cuenta o tarjeta). Es el eje
/// de caja, independiente del eje económico.
/// </summary>
public enum CashFlow
{
    /// <summary>No mueve dinero: devengo, causación o metadato con importe.</summary>
    None = 0,

    /// <summary>Entra dinero al instrumento (o disminuye la deuda de la tarjeta).</summary>
    Inflow = 1,

    /// <summary>Sale dinero del instrumento (o aumenta la deuda de la tarjeta).</summary>
    Outflow = 2,
}

/// <summary>
/// Procedencia del movimiento. La materialización de un recurrente y la
/// confirmación de un escenario son orígenes, no clases distintas de
/// movimiento: un recurrente materializado sigue siendo ingreso o gasto.
/// </summary>
public enum MovementOrigin
{
    Manual = 0,

    /// <summary>Generado al materializar un recurrente (§4.1 del plan).</summary>
    RecurrenceMaterialization = 1,

    /// <summary>Importado desde el backend heredado o un archivo externo.</summary>
    Import = 2,

    /// <summary>
    /// Confirmación explícita de un escenario del simulador. Una proyección
    /// nunca llega al ledger sin pasar por aquí (regla financiera 10).
    /// </summary>
    ScenarioConfirmation = 3,
}

/// <summary>Enlaces posibles de un movimiento, como banderas combinables.</summary>
[Flags]
public enum MovementLink
{
    None = 0,
    Operation = 1 << 0,
    Account = 1 << 1,
    Card = 1 << 2,
    Category = 1 << 3,
    Counterparty = 1 << 4,
    Obligation = 1 << 5,
    Recurrence = 1 << 6,
    Position = 1 << 7,
    SharedPurchase = 1 << 8,
}
