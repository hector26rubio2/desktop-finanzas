using Finanzas.Domain.Common;
using Finanzas.Domain.Identifiers;
using Finanzas.Domain.ValueObjects;

namespace Finanzas.Domain.Ledger;

/// <summary>Tipo de operación compuesta.</summary>
public enum OperationKind
{
    /// <summary>Transferencia entre cuentas propias: dos patas que se compensan.</summary>
    Transfer = 1,

    /// <summary>Pago de tarjeta: sale de la cuenta, entra a la tarjeta.</summary>
    CardPayment = 2,

    /// <summary>Desembolso de préstamo con su contrapartida en caja.</summary>
    LoanDisbursement = 3,

    /// <summary>Abono a una obligación, con su parte de capital e intereses.</summary>
    LoanPayment = 4,

    /// <summary>Compra o venta de inversión con su movimiento de caja.</summary>
    InvestmentTrade = 5,

    /// <summary>Compra con tarjeta asignada a una o varias personas.</summary>
    SharedPurchase = 6,

    Other = 99,
}

/// <summary>
/// Agrupa las patas de una operación compuesta. Existe para que una
/// transferencia o un pago de tarjeta sean una sola cosa auditable y no dos
/// movimientos sueltos que alguien puede desparejar.
/// </summary>
/// <remarks>
/// <b>Idempotencia (regla financiera 7).</b> <see cref="IdempotencyKey"/> es la
/// clave natural que la capa de aplicación usa para no duplicar una operación
/// reintentada. El dominio solo garantiza que exista y sea estable; la unicidad
/// la impone la persistencia.
/// </remarks>
public sealed class Operation : AggregateRoot<OperationId>
{
    private readonly List<Movement> _legs = [];

    private Operation(
        OperationId id,
        OperationKind kind,
        DateOnly date,
        string? description,
        string? idempotencyKey,
        DateTimeOffset createdAt)
        : base(id)
    {
        Kind = kind;
        Date = date;
        Description = description;
        IdempotencyKey = idempotencyKey;
        CreatedAt = createdAt;
    }

    public OperationKind Kind { get; }

    public DateOnly Date { get; }

    public string? Description { get; }

    public string? IdempotencyKey { get; }

    public DateTimeOffset CreatedAt { get; }

    public IReadOnlyList<Movement> Legs => _legs;

    /// <summary>Operaciones cuyas patas deben sumar exactamente cero en caja.</summary>
    public bool RequiresZeroSum => Kind is OperationKind.Transfer or OperationKind.CardPayment;

    public static Operation Create(
        OperationId id,
        OperationKind kind,
        DateOnly date,
        DateTimeOffset createdAt,
        string? description = null,
        string? idempotencyKey = null) =>
        new(id, kind, date, description, idempotencyKey, createdAt);

    /// <summary>Añade una pata exigiendo que apunte a esta operación.</summary>
    public void AddLeg(Movement movement)
    {
        Guard.NotNull(movement);
        Guard.Require(
            movement.Links.Operation == Id,
            DomainErrorCodes.OperationLegMismatch,
            $"El movimiento {movement.Id} no pertenece a la operación {Id}.");

        Guard.Require(
            !_legs.Any(leg => leg.Id == movement.Id),
            DomainErrorCodes.OperationLegMismatch,
            $"El movimiento {movement.Id} ya está en la operación {Id}.");

        _legs.Add(movement);
    }

    /// <summary>
    /// Valida la operación completa. Para transferencias y pagos de tarjeta,
    /// las patas efectivas deben sumar cero en moneda base: nada se crea ni se
    /// pierde al mover dinero entre instrumentos propios.
    /// </summary>
    public void EnsureConsistent(Currency baseCurrency)
    {
        Guard.NotNull(baseCurrency);

        if (!RequiresZeroSum)
        {
            return;
        }

        Guard.Require(
            _legs.Count >= 2,
            DomainErrorCodes.OperationTooFewLegs,
            $"Una operación de tipo {Kind} necesita al menos dos patas (tiene {_legs.Count}).");

        var hasInflow = _legs.Any(leg => leg.Flow == CashFlow.Inflow);
        var hasOutflow = _legs.Any(leg => leg.Flow == CashFlow.Outflow);
        Guard.Require(
            hasInflow && hasOutflow,
            DomainErrorCodes.OperationUnbalanced,
            $"Una operación de tipo {Kind} necesita una pata de entrada y una de salida.");

        // Se suman todas las patas, reversos incluidos: un reverso aporta el
        // signo contrario, así que el par original + reverso sigue cuadrando.
        var total = Money.Sum(_legs.Select(leg => leg.SignedCashBase), baseCurrency);
        Guard.Require(
            total.IsZero,
            DomainErrorCodes.OperationUnbalanced,
            $"Las patas de la operación {Id} no cuadran: descuadre de {total} en moneda base.");
    }

    public override string ToString() => $"{Date:yyyy-MM-dd} {Kind} ({_legs.Count} patas)";
}
