using Finanzas.Domain.Common;
using Finanzas.Domain.Identifiers;
using Finanzas.Domain.ValueObjects;

namespace Finanzas.Domain.Investments;

public enum RiskLevel
{
    Low = 1,
    Medium = 2,
    High = 3,
}

/// <summary>
/// Posición de inversión: instrumento, operaciones y serie de valoración.
/// </summary>
/// <remarks>
/// <b>Separación central (§4.1).</b> El flujo de caja vive en las operaciones,
/// que siempre tienen movimiento en el ledger; la valoración vive en una serie
/// aparte que jamás produce movimientos. La ganancia no realizada es la
/// diferencia entre ambas y nunca se registra como ingreso.
/// </remarks>
public sealed class InvestmentPosition : AggregateRoot<PositionId>
{
    private readonly List<InvestmentOperation> _operations = [];
    private readonly List<Valuation> _valuations = [];

    private InvestmentPosition(
        PositionId id,
        string name,
        string instrumentType,
        Currency currency,
        RiskLevel risk,
        string? symbol,
        string? institution,
        DateTimeOffset createdAt)
        : base(id)
    {
        Name = name;
        InstrumentType = instrumentType;
        Currency = currency;
        Risk = risk;
        Symbol = symbol;
        Institution = institution;
        CreatedAt = createdAt;
        IsActive = true;
    }

    public string Name { get; private set; }

    /// <summary>
    /// Código del catálogo de instrumentos (acción, ETF, fondo, cripto...). Es
    /// texto y no un <c>enum</c> a propósito: el catálogo crece en tiempo de
    /// ejecución sin migración (DISENO_BD §3.6).
    /// </summary>
    public string InstrumentType { get; private set; }

    public Currency Currency { get; }

    public RiskLevel Risk { get; private set; }

    public string? Symbol { get; private set; }

    public string? Institution { get; private set; }

    public bool IsActive { get; private set; }

    public DateTimeOffset CreatedAt { get; }

    public IReadOnlyList<InvestmentOperation> Operations => _operations;

    public IReadOnlyList<Valuation> Valuations => _valuations;

    /// <summary>Unidades en poder, derivadas de compras y ventas.</summary>
    public decimal Quantity => _operations
        .Where(op => op.MovesUnits)
        .Sum(op => op.Type == InvestmentOperationType.Buy ? op.Quantity!.Value : -op.Quantity!.Value);

    /// <summary>
    /// Costo de las unidades en poder, por costo promedio ponderado. Es la
    /// convención documentada del dominio (no FIFO ni LIFO).
    /// </summary>
    public Money CostBasis
    {
        get
        {
            var quantity = 0m;
            var cost = Money.Zero(Currency);

            foreach (var op in _operations.Where(o => o.MovesUnits).OrderBy(o => o.Date))
            {
                if (op.Type == InvestmentOperationType.Buy)
                {
                    quantity += op.Quantity!.Value;
                    cost += op.Amount;
                    continue;
                }

                var sold = op.Quantity!.Value;
                var averageCost = quantity == 0m ? Money.Zero(Currency) : cost.Multiply(sold / quantity);
                cost -= averageCost;
                quantity -= sold;
            }

            return cost;
        }
    }

    /// <summary>Costo promedio por unidad, o cero si no hay unidades.</summary>
    public Money AverageUnitCost =>
        Quantity == 0m ? Money.Zero(Currency) : CostBasis.Divide(Quantity);

    /// <summary>Aportes menos retiros de efectivo.</summary>
    public Money NetContributions =>
        _operations.Where(op => op.Type == InvestmentOperationType.Contribution)
            .Aggregate(Money.Zero(Currency), (total, op) => total + op.Amount)
        - _operations.Where(op => op.Type == InvestmentOperationType.Withdrawal)
            .Aggregate(Money.Zero(Currency), (total, op) => total + op.Amount);

    public static InvestmentPosition Create(
        PositionId id,
        string name,
        string instrumentType,
        Currency currency,
        RiskLevel risk,
        DateTimeOffset createdAt,
        string? symbol = null,
        string? institution = null)
    {
        Guard.NotNull(currency);
        return new InvestmentPosition(
            id,
            Guard.NotBlank(name),
            Guard.NotBlank(instrumentType),
            currency,
            risk,
            string.IsNullOrWhiteSpace(symbol) ? null : symbol.Trim().ToUpperInvariant(),
            string.IsNullOrWhiteSpace(institution) ? null : institution.Trim(),
            createdAt);
    }

    /// <summary>
    /// Registra una operación. No se puede vender más de lo que se tiene ni
    /// registrar dos veces el mismo movimiento.
    /// </summary>
    public void RegisterOperation(InvestmentOperation operation)
    {
        Guard.NotNull(operation);
        Guard.Require(
            operation.Amount.Currency == Currency,
            DomainErrorCodes.CurrencyMismatch,
            $"La posición está en {Currency.Code} y la operación en {operation.Amount.Currency.Code}.");

        Guard.Require(
            _operations.All(op => op.Movement != operation.Movement),
            DomainErrorCodes.PositionInvalidOperation,
            $"El movimiento {operation.Movement} ya está registrado en la posición.");

        if (operation.Type == InvestmentOperationType.Sell)
        {
            Guard.Require(
                operation.Quantity!.Value <= Quantity,
                DomainErrorCodes.PositionInsufficientQuantity,
                $"No se pueden vender {operation.Quantity} unidades: la posición tiene {Quantity}.");
        }

        _operations.Add(operation);
    }

    /// <summary>Añade una valoración a la serie. Nunca genera movimiento.</summary>
    public void AddValuation(Valuation valuation)
    {
        Guard.NotNull(valuation);
        Guard.Require(
            valuation.Value.Currency == Currency,
            DomainErrorCodes.CurrencyMismatch,
            $"La posición está en {Currency.Code} y la valoración en {valuation.Value.Currency.Code}.");

        Guard.Require(
            _valuations.All(existing => existing.Id != valuation.Id),
            DomainErrorCodes.PositionValuationIsNotCashFlow,
            $"La valoración {valuation.Id} ya está registrada.");

        _valuations.Add(valuation);
    }

    /// <summary>Última valoración con fecha menor o igual a la indicada.</summary>
    public Valuation? LatestValuation(DateOnly asOf) =>
        _valuations.Where(v => v.Date <= asOf)
            .OrderByDescending(v => v.Date)
            .FirstOrDefault();

    /// <summary>Valor de mercado a una fecha, si hay valoración disponible.</summary>
    public Money? MarketValue(DateOnly asOf) => LatestValuation(asOf)?.Value;

    /// <summary>
    /// Ganancia o pérdida <b>no realizada</b>: valor de mercado menos costo. No
    /// es un ingreso y no llega al ledger hasta que se vende.
    /// </summary>
    public Money? UnrealizedGain(DateOnly asOf)
    {
        var value = MarketValue(asOf);
        return value is null ? null : value - CostBasis;
    }

    public void Rename(string name) => Name = Guard.NotBlank(name);

    public void Reclassify(string instrumentType, RiskLevel risk, string? symbol)
    {
        InstrumentType = Guard.NotBlank(instrumentType);
        Risk = risk;
        Symbol = string.IsNullOrWhiteSpace(symbol) ? null : symbol.Trim().ToUpperInvariant();
    }

    public void Deactivate() => IsActive = false;

    public void Activate() => IsActive = true;

    public override string ToString() => $"{Name} ({InstrumentType}, {Currency.Code})";
}
