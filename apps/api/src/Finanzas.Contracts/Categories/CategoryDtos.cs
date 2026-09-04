namespace Finanzas.Contracts.Categories;

/// <summary>
/// Lado del resultado al que pertenece la categoría. Espejo de
/// <c>Finanzas.Domain.Categories.CategoryType</c>.
/// </summary>
/// <remarks>
/// No existe categoría neutra, y la ausencia es deliberada: un movimiento que no
/// es ingreso ni gasto tiene prohibida la categoría, porque categorizar un
/// traslado lo haría aparecer en los reportes además del gasto real (regla
/// financiera 2).
/// </remarks>
public enum CategoryTypeDto
{
    Income = 1,
    Expense = 2,
}

/// <summary>Categoría de ingreso o gasto, opcionalmente anidada.</summary>
/// <param name="Id">Identificador de la categoría.</param>
/// <param name="Name">Nombre visible.</param>
/// <param name="Type">Lado del resultado.</param>
/// <param name="Color">Color en formato <c>#rrggbb</c>.</param>
/// <param name="Icon">Nombre del icono.</param>
/// <param name="Parent">Categoría madre, si es una subcategoría.</param>
/// <param name="IsActive">Sigue ofreciéndose al clasificar.</param>
/// <param name="CreatedAt">Instante de creación.</param>
public sealed record CategoryDto(
    Guid Id,
    string Name,
    CategoryTypeDto Type,
    string Color,
    string Icon,
    Guid? Parent,
    bool IsActive,
    DateTimeOffset CreatedAt);

/// <summary>Alta de una categoría.</summary>
/// <remarks>
/// El tipo se fija al crear: cambiarlo movería de lado del resultado todos los
/// movimientos ya clasificados con ella.
/// </remarks>
/// <param name="Name">Nombre visible.</param>
/// <param name="Type">Lado del resultado.</param>
/// <param name="Color">Color en formato <c>#rrggbb</c>.</param>
/// <param name="Icon">Nombre del icono.</param>
/// <param name="Parent">Categoría madre, si es una subcategoría.</param>
public sealed record CreateCategoryRequest(
    string Name,
    CategoryTypeDto Type,
    string Color,
    string Icon,
    Guid? Parent = null);

/// <summary>Edición de una categoría.</summary>
/// <param name="Name">Nombre visible.</param>
/// <param name="Color">Color en formato <c>#rrggbb</c>.</param>
/// <param name="Icon">Nombre del icono.</param>
/// <param name="Parent">Categoría madre, o nulo para dejarla en la raíz.</param>
/// <param name="IsActive">Activa o archivada.</param>
public sealed record UpdateCategoryRequest(
    string Name,
    string Color,
    string Icon,
    Guid? Parent,
    bool IsActive);
