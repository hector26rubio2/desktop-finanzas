using Finanzas.Domain.Common;
using Finanzas.Domain.Identifiers;

namespace Finanzas.Domain.Categories;

public enum CategoryType
{
    Income = 1,
    Expense = 2,
}

/// <summary>
/// Categoría de clasificación de ingresos y gastos. Solo clasifica movimientos
/// con efecto económico: el ledger prohíbe categorizar movimientos neutros
/// (transferencias, abonos, pagos de tarjeta) para que ningún reporte cuente
/// dos veces el mismo hecho económico.
/// </summary>
public sealed class Category : AggregateRoot<CategoryId>
{
    private Category(
        CategoryId id,
        string name,
        CategoryType type,
        string color,
        string icon,
        CategoryId? parent,
        DateTimeOffset createdAt)
        : base(id)
    {
        Name = name;
        Type = type;
        Color = color;
        Icon = icon;
        Parent = parent;
        CreatedAt = createdAt;
        IsActive = true;
    }

    public string Name { get; private set; }

    /// <summary>Ingreso o gasto. No cambia: reclasificaría el histórico.</summary>
    public CategoryType Type { get; }

    /// <summary>Color en formato <c>#rrggbb</c>.</summary>
    public string Color { get; private set; }

    public string Icon { get; private set; }

    /// <summary>
    /// Categoría padre opcional. El dominio garantiza que no es ella misma; la
    /// ausencia de ciclos en el árbol completo la valida la capa de aplicación,
    /// que sí ve todas las categorías.
    /// </summary>
    public CategoryId? Parent { get; private set; }

    public bool IsActive { get; private set; }

    public DateTimeOffset CreatedAt { get; }

    public static Category Create(
        CategoryId id,
        string name,
        CategoryType type,
        string color,
        string icon,
        DateTimeOffset createdAt,
        CategoryId? parent = null)
    {
        var category = new Category(
            id,
            Guard.NotBlank(name),
            type,
            NormalizeColor(color),
            Guard.NotBlank(icon),
            parent,
            createdAt);

        category.EnsureParentIsNotSelf(parent);
        return category;
    }

    public void Rename(string name) => Name = Guard.NotBlank(name);

    public void Restyle(string color, string icon)
    {
        Color = NormalizeColor(color);
        Icon = Guard.NotBlank(icon);
    }

    public void MoveUnder(CategoryId? parent)
    {
        EnsureParentIsNotSelf(parent);
        Parent = parent;
    }

    public void Deactivate() => IsActive = false;

    public void Activate() => IsActive = true;

    private void EnsureParentIsNotSelf(CategoryId? parent) =>
        Guard.Require(
            parent is null || parent.Value != Id,
            DomainErrorCodes.InvariantViolation,
            "Una categoría no puede ser su propia categoría padre.");

    private static string NormalizeColor(string color)
    {
        var value = Guard.NotBlank(color);
        Guard.Require(
            value.Length == 7 && value[0] == '#' && value[1..].All(char.IsAsciiHexDigit),
            DomainErrorCodes.OutOfRange,
            $"'{color}' no es un color hexadecimal '#rrggbb'.");
        return value.ToLowerInvariant();
    }

    public override string ToString() => $"{Name} [{Type}]";
}
