using Finanzas.Contracts.Common;

namespace Finanzas.Contracts.Ledger;

/// <summary>Campo por el que se ordena un listado de movimientos.</summary>
public enum MovementSortFieldDto
{
    /// <summary>Fecha contable. Es el orden por omisión, descendente.</summary>
    Date = 0,

    /// <summary>Importe en moneda base, para no comparar peras con dólares.</summary>
    AmountBase = 1,

    /// <summary>Instante de creación: desempata movimientos del mismo día.</summary>
    CreatedAt = 2,

    Kind = 3,
}

/// <summary>Cómo tratar los movimientos anulados y sus reversos.</summary>
/// <remarks>
/// Ninguna de las tres opciones borra nada: el par original + reverso sigue
/// sumando cero en los saldos. Esto solo decide qué se muestra (regla
/// financiera 6).
/// </remarks>
public enum ReversalFilterDto
{
    /// <summary>Todo: originales, anulados y reversos.</summary>
    Include = 0,

    /// <summary>Oculta el par completo: ni el anulado ni su reverso.</summary>
    ExcludePairs = 1,

    /// <summary>Solo los pares anulados, para revisar correcciones.</summary>
    OnlyReversed = 2,
}

/// <summary>
/// Filtro de movimientos. Viaja como DTO y no como cadena de consulta armada en
/// el cliente (decisión de <c>HANDOFF.md</c> §1).
/// </summary>
/// <remarks>
/// <para>Los campos de lista son disyunciones —cualquiera de los valores— y los
/// campos entre sí son conjunciones: filtrar por dos cuentas y una categoría
/// devuelve los movimientos de esa categoría en cualquiera de las dos cuentas.
/// Una lista vacía y una lista ausente significan lo mismo: no filtrar por ese
/// campo.</para>
/// <para>Los importes van como texto invariante, por la misma razón que el resto
/// del dinero, y se comparan contra el importe en <b>moneda base</b>: comparar
/// contra la moneda original mezclaría escalas distintas en un mismo listado.</para>
/// </remarks>
public sealed record MovementFilterDto
{
    /// <summary>Rango de fechas contables, inclusivo por ambos extremos.</summary>
    public DateRangeDto? Range { get; init; }

    public IReadOnlyList<MovementKindDto>? Kinds { get; init; }

    public IReadOnlyList<EconomicEffectDto>? Effects { get; init; }

    public IReadOnlyList<CashFlowDto>? Flows { get; init; }

    public IReadOnlyList<MovementOriginDto>? Origins { get; init; }

    public IReadOnlyList<Guid>? Accounts { get; init; }

    public IReadOnlyList<Guid>? Cards { get; init; }

    /// <summary>Categorías. No alcanza a los movimientos neutros, que no la admiten.</summary>
    public IReadOnlyList<Guid>? Categories { get; init; }

    public IReadOnlyList<Guid>? Counterparties { get; init; }

    public IReadOnlyList<Guid>? Obligations { get; init; }

    public IReadOnlyList<Guid>? Positions { get; init; }

    public IReadOnlyList<Guid>? Recurrences { get; init; }

    /// <summary>Búsqueda libre sobre la descripción, sin distinguir mayúsculas.</summary>
    public string? Text { get; init; }

    /// <summary>Importe mínimo en moneda base, como texto invariante.</summary>
    public string? MinAmountBase { get; init; }

    /// <summary>Importe máximo en moneda base, como texto invariante.</summary>
    public string? MaxAmountBase { get; init; }

    /// <summary>Sin enlace de categoría: los que quedaron por clasificar.</summary>
    public bool? Uncategorized { get; init; }

    public ReversalFilterDto Reversals { get; init; } = ReversalFilterDto.Include;
}

/// <summary>Consulta paginada de movimientos: filtro, orden y página.</summary>
/// <param name="Filter">Filtro aplicado. Nulo devuelve todo.</param>
/// <param name="Page">Página solicitada.</param>
/// <param name="SortBy">Campo de orden.</param>
/// <param name="Direction">Sentido del orden.</param>
public sealed record MovementQueryDto(
    MovementFilterDto? Filter = null,
    PageRequestDto? Page = null,
    MovementSortFieldDto SortBy = MovementSortFieldDto.Date,
    SortDirectionDto Direction = SortDirectionDto.Descending);
