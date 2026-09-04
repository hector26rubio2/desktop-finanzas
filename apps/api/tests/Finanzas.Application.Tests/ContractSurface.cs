using System.Reflection;
using System.Runtime.CompilerServices;
using System.Text;

namespace Finanzas.Application.Tests;

/// <summary>
/// Vuelca la superficie pública de <c>Finanzas.Contracts</c> como texto estable
/// y ordenado, para poder compararla contra una instantánea aprobada.
/// </summary>
/// <remarks>
/// Se registra lo que el cliente puede ver: tipos exportados, miembros de cada
/// enum con su valor numérico y propiedades públicas con su tipo, su
/// nulabilidad y sus accesores. Renombrar una propiedad, ensanchar un tipo o
/// quitarle el interrogante a un <c>string?</c> cambia este texto, que es
/// justamente lo que rompe a un cliente ya escrito.
/// </remarks>
internal static class ContractSurface
{
    private static readonly NullabilityInfoContext Nullability = new();

    public static string Dump(Assembly assembly)
    {
        var builder = new StringBuilder();

        foreach (var type in assembly.GetExportedTypes().OrderBy(t => t.FullName, StringComparer.Ordinal))
        {
            if (type.IsEnum)
            {
                DumpEnum(builder, type);
            }
            else
            {
                DumpType(builder, type);
            }

            builder.AppendLine();
        }

        return builder.ToString().ReplaceLineEndings("\n").TrimEnd() + "\n";
    }

    private static void DumpEnum(StringBuilder builder, Type type)
    {
        var flags = type.GetCustomAttribute<FlagsAttribute>() is null ? string.Empty : "[Flags] ";
        builder.AppendLine($"{flags}enum {type.FullName}");

        foreach (var name in Enum.GetNames(type).Order(StringComparer.Ordinal))
        {
            var value = Convert.ToInt64(Enum.Parse(type, name));
            builder.AppendLine($"    {name} = {value}");
        }
    }

    private static void DumpType(StringBuilder builder, Type type)
    {
        builder.AppendLine($"{Shape(type)} {Name(type)}");

        var properties = type
            .GetProperties(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly)
            .Where(p => p.GetMethod is { IsPublic: true })
            .OrderBy(p => p.Name, StringComparer.Ordinal);

        foreach (var property in properties)
        {
            builder.AppendLine($"    {Name(property.PropertyType)}{Suffix(property)} {property.Name} {{ {Accessors(property)} }}");
        }
    }

    private static string Shape(Type type) => type switch
    {
        { IsInterface: true } => "interface",
        { IsValueType: true } => "struct",
        _ => "class",
    };

    /// <summary>Interrogante si la propiedad admite nulo.</summary>
    private static string Suffix(PropertyInfo property)
    {
        if (Nullable.GetUnderlyingType(property.PropertyType) is not null)
        {
            // Ya lo dice el propio tipo: Guid? se imprime como Guid?.
            return string.Empty;
        }

        return Nullability.Create(property).ReadState == NullabilityState.Nullable ? "?" : string.Empty;
    }

    private static string Accessors(PropertyInfo property)
    {
        var accessors = new List<string> { "get;" };

        if (property.SetMethod is { IsPublic: true } setter)
        {
            var isInit = setter.ReturnParameter
                .GetRequiredCustomModifiers()
                .Any(modifier => modifier == typeof(IsExternalInit));

            accessors.Add(isInit ? "init;" : "set;");
        }

        return string.Join(" ", accessors);
    }

    /// <summary>Nombre legible: sin espacio de nombres del sistema, con genéricos expandidos.</summary>
    private static string Name(Type type)
    {
        if (Nullable.GetUnderlyingType(type) is { } underlying)
        {
            return Name(underlying) + "?";
        }

        if (type.IsGenericType)
        {
            var definition = type.Name[..type.Name.IndexOf('`')];
            var arguments = string.Join(", ", type.GetGenericArguments().Select(Name));
            return $"{Prefix(type)}{definition}<{arguments}>";
        }

        if (type.IsGenericTypeDefinition || type.IsGenericParameter)
        {
            return type.Name;
        }

        return Alias(type) ?? $"{Prefix(type)}{type.Name}";
    }

    /// <summary>Solo los tipos del contrato llevan su espacio de nombres.</summary>
    private static string Prefix(Type type) =>
        type.Namespace?.StartsWith("Finanzas.", StringComparison.Ordinal) == true
            ? type.Namespace + "."
            : string.Empty;

    /// <summary>
    /// Alias de los tipos primitivos. Un enum queda fuera a propósito: su
    /// <c>TypeCode</c> es el del subyacente, así que sin esta guarda todo enum
    /// se imprimiría como <c>int</c> y la instantánea no vería el día en que una
    /// propiedad cambie de <c>MovementKindDto</c> a <c>EconomicEffectDto</c>.
    /// </summary>
    private static string? Alias(Type type) => type.IsEnum ? null : Type.GetTypeCode(type) switch
    {
        TypeCode.Boolean => "bool",
        TypeCode.Int32 => "int",
        TypeCode.Int64 => "long",
        TypeCode.Decimal => "decimal",
        TypeCode.String => "string",
        _ => null,
    };
}
