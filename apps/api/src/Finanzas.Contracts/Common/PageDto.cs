namespace Finanzas.Contracts.Common;

/// <summary>Sentido de ordenación.</summary>
public enum SortDirectionDto
{
    Ascending = 0,

    Descending = 1,
}

/// <summary>
/// Página solicitada. Los filtros y la paginación viajan como DTO y no como
/// cadena de consulta armada en el cliente (decisión de <c>HANDOFF.md</c> §1):
/// así el compilador y las pruebas ven la superficie, y no un <c>string</c>.
/// </summary>
/// <param name="Page">Número de página, empezando en 1.</param>
/// <param name="Size">Tamaño de página. El servidor impone su propio máximo.</param>
public sealed record PageRequestDto(int Page = 1, int Size = 50);

/// <summary>Página devuelta.</summary>
/// <remarks>
/// <see cref="Total"/> es el total de elementos que cumplen el filtro, no los
/// de esta página: sin él la tabla no puede pintar la paginación.
/// </remarks>
/// <param name="Items">Elementos de esta página.</param>
/// <param name="Page">Número de página devuelta, empezando en 1.</param>
/// <param name="Size">Tamaño de página aplicado, que puede ser menor al pedido.</param>
/// <param name="Total">Total de elementos que cumplen el filtro.</param>
public sealed record PageDto<T>(
    IReadOnlyList<T> Items,
    int Page,
    int Size,
    int Total)
{
    /// <summary>Número de páginas que cubren el total.</summary>
    public int TotalPages => Size <= 0 ? 0 : (Total + Size - 1) / Size;

    /// <summary>Hay al menos una página más después de esta.</summary>
    public bool HasNext => Page < TotalPages;
}

/// <summary>Intervalo de fechas cerrado por ambos extremos.</summary>
/// <param name="Start">Primer día incluido.</param>
/// <param name="End">Último día incluido.</param>
public sealed record DateRangeDto(DateOnly Start, DateOnly End);
