namespace Finanzas.Contracts.Ledger;

/// <summary>
/// Clase de un movimiento. Espejo de <c>Finanzas.Domain.Ledger.MovementKind</c>.
/// </summary>
/// <remarks>
/// <para><b>Por qué se duplica el enum.</b> <c>Contracts</c> no referencia a
/// <c>Domain</c> —esa flecha no existe en la dirección de dependencias— para que
/// congelar el contrato no congele el modelo ni al revés. La duplicación es
/// deliberada y no queda librada a la buena fe: una prueba de paridad compara
/// nombres y valores numéricos de cada par de enums, así que añadir una clase en
/// el dominio y olvidarla aquí rompe la construcción.</para>
/// <para>Los valores numéricos son los del dominio y son parte del contrato: el
/// cliente puede persistirlos.</para>
/// </remarks>
public enum MovementKindDto
{
    Income = 1,
    Expense = 2,
    TransferOut = 10,
    TransferIn = 11,
    CardPurchase = 20,
    CardPayment = 21,
    CardInterest = 22,
    CardFee = 23,
    InvestmentContribution = 30,
    InvestmentWithdrawal = 31,
    InvestmentBuy = 32,
    InvestmentSell = 33,
    InvestmentDividend = 34,
    InvestmentFee = 35,
    LoanDisbursement = 40,
    LoanCharge = 41,
    LoanInterest = 42,
    LoanRepayment = 43,
    LoanAdjustment = 44,
}

/// <summary>
/// Efecto sobre el resultado del periodo. Espejo de
/// <c>Finanzas.Domain.Ledger.EconomicEffect</c>.
/// </summary>
/// <remarks>
/// Es un eje independiente del flujo de caja: un pago de tarjeta mueve dinero y
/// es <see cref="Neutral"/>; un devengo de interés es <see cref="Expense"/> sin
/// mover dinero. Confundirlos es el doble conteo que prohíbe la regla
/// financiera 2.
/// </remarks>
public enum EconomicEffectDto
{
    Neutral = 0,
    Income = 1,
    Expense = 2,
}

/// <summary>
/// Efecto sobre el saldo del instrumento. Espejo de
/// <c>Finanzas.Domain.Ledger.CashFlow</c>.
/// </summary>
public enum CashFlowDto
{
    None = 0,
    Inflow = 1,
    Outflow = 2,
}

/// <summary>
/// Procedencia del movimiento. Espejo de
/// <c>Finanzas.Domain.Ledger.MovementOrigin</c>.
/// </summary>
public enum MovementOriginDto
{
    Manual = 0,
    RecurrenceMaterialization = 1,
    Import = 2,
    ScenarioConfirmation = 3,
}

/// <summary>
/// Enlaces posibles de un movimiento, como banderas combinables. Espejo de
/// <c>Finanzas.Domain.Ledger.MovementLink</c>.
/// </summary>
public enum MovementLinkDto
{
    None = 0,
    Operation = 1,
    Account = 2,
    Card = 4,
    Category = 8,
    Counterparty = 16,
    Obligation = 32,
    Recurrence = 64,
    Position = 128,
    SharedPurchase = 256,
}

/// <summary>
/// Clase de una operación compuesta. Espejo de
/// <c>Finanzas.Domain.Ledger.OperationKind</c>.
/// </summary>
public enum OperationKindDto
{
    Transfer = 1,
    CardPayment = 2,
    LoanDisbursement = 3,
    LoanPayment = 4,
    InvestmentTrade = 5,
    SharedPurchase = 6,
    Other = 99,
}
