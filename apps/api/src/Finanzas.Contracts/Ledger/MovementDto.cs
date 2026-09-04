using Finanzas.Contracts.Common;

namespace Finanzas.Contracts.Ledger;

/// <summary>
/// Enlaces de un movimiento hacia el resto del modelo. Todos opcionales aquí;
/// qué combinación es legal lo dice <see cref="MovementKindSpecDto"/>, que viaja
/// como dato y no como reglas reescritas en el cliente.
/// </summary>
public sealed record MovementLinksDto
{
    public Guid? Operation { get; init; }

    public Guid? Account { get; init; }

    public Guid? Card { get; init; }

    public Guid? Category { get; init; }

    public Guid? Counterparty { get; init; }

    public Guid? Obligation { get; init; }

    public Guid? Recurrence { get; init; }

    public Guid? Position { get; init; }

    public Guid? SharedPurchase { get; init; }
}

/// <summary>
/// Nombre ya resuelto de un enlace, para que la tabla y el inspector no tengan
/// que pedir cada entidad por separado ni el cliente mantenga su propio caché.
/// </summary>
/// <param name="Id">Identificador de la entidad enlazada.</param>
/// <param name="Name">Nombre visible en el momento de la consulta.</param>
public sealed record LinkRefDto(Guid Id, string Name);

/// <summary>
/// Nombres resueltos de los enlaces presentes en un movimiento. Un enlace
/// ausente en <see cref="MovementLinksDto"/> también está ausente aquí.
/// </summary>
public sealed record MovementLinkNamesDto
{
    public LinkRefDto? Account { get; init; }

    public LinkRefDto? Card { get; init; }

    public LinkRefDto? Category { get; init; }

    public LinkRefDto? Counterparty { get; init; }

    public LinkRefDto? Obligation { get; init; }

    public LinkRefDto? Recurrence { get; init; }

    public LinkRefDto? Position { get; init; }
}

/// <summary>
/// Movimiento: la fila del ledger, fuente de verdad transversal (§4.1 del plan).
/// Tarjetas, préstamos, recurrentes e inversiones son proyecciones sobre esta
/// lista, no saldos editables aparte.
/// </summary>
/// <remarks>
/// <para><b>Signo.</b> <see cref="Amount"/> siempre es positivo. El sentido lo
/// dan <see cref="Flow"/> —caja— y <see cref="Effect"/> —resultado—, que son
/// ejes independientes. Pintar un movimiento en rojo por su importe, sin mirar
/// esos dos campos, es leer mal el contrato.</para>
/// <para><b>Anulados.</b> Un movimiento reversado conserva
/// <see cref="ReversedBy"/> y <b>sigue contando</b> en los saldos: el par
/// original + reverso suma cero. Esconderlo del listado reescribe el pasado en
/// lugar de auditarlo (regla financiera 6).</para>
/// </remarks>
/// <param name="Id">Identificador del movimiento.</param>
/// <param name="Date">Fecha contable.</param>
/// <param name="Kind">Clase del movimiento.</param>
/// <param name="Effect">Efecto sobre el resultado del periodo.</param>
/// <param name="Flow">Efecto sobre el saldo del instrumento.</param>
/// <param name="Amount">Importe original, tasa aplicada e importe en moneda base.</param>
/// <param name="Links">Enlaces hacia el resto del modelo.</param>
/// <param name="LinkNames">Nombres ya resueltos de esos enlaces.</param>
/// <param name="Origin">Procedencia del movimiento.</param>
/// <param name="Description">Descripción libre, ya recortada.</param>
/// <param name="CreatedAt">Instante de creación.</param>
/// <param name="ReversalOf">Movimiento que este reversa, si es un reverso.</param>
/// <param name="ReversedBy">Reverso que anuló este movimiento, si lo hay.</param>
public sealed record MovementDto(
    Guid Id,
    DateOnly Date,
    MovementKindDto Kind,
    EconomicEffectDto Effect,
    CashFlowDto Flow,
    ConvertedMoneyDto Amount,
    MovementLinksDto Links,
    MovementLinkNamesDto LinkNames,
    MovementOriginDto Origin,
    string? Description,
    DateTimeOffset CreatedAt,
    Guid? ReversalOf,
    Guid? ReversedBy);

/// <summary>
/// Operación compuesta: agrupa las patas que deben nacer y morir juntas, como
/// las dos de una transferencia.
/// </summary>
/// <param name="Id">Identificador de la operación.</param>
/// <param name="Kind">Clase de la operación.</param>
/// <param name="Date">Fecha contable.</param>
/// <param name="Description">Descripción libre.</param>
/// <param name="CreatedAt">Instante de creación.</param>
/// <param name="Legs">Patas de la operación, en el orden en que se registraron.</param>
public sealed record OperationDto(
    Guid Id,
    OperationKindDto Kind,
    DateOnly Date,
    string? Description,
    DateTimeOffset CreatedAt,
    IReadOnlyList<MovementDto> Legs);
