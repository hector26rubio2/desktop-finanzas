using System.Collections.Frozen;
using Finanzas.Domain.Common;

namespace Finanzas.Domain.ValueObjects;

/// <summary>
/// Moneda ISO 4217. Es un tipo de referencia y no un <c>string</c> suelto: así
/// no existe la moneda "vacía" ni la comparación accidental entre "usd" y "USD".
/// </summary>
/// <remarks>
/// <para><b>Unidades menores.</b> El número de decimales sigue ISO 4217. La
/// tabla solo enumera las excepciones al valor por omisión (2 decimales);
/// cualquier código no listado se asume de 2.</para>
/// <para><b>Excepción deliberada: <c>COP</c> usa 0 decimales</b>, no los 2 de
/// ISO 4217. Decisión del integrador registrada en <c>HANDOFF.md</c> §1: el uso
/// cotidiano colombiano no maneja centavos y las cifras deben cuadrar contra
/// extractos bancarios reales. En consecuencia, todo reparto en pesos se hace
/// sobre unidades enteras y
/// <see cref="Money.Allocate(System.Collections.Generic.IReadOnlyList{decimal})"/>
/// sigue garantizando que la suma de las partes es exactamente el total.</para>
/// <para>La igualdad es únicamente por <see cref="Code"/>.</para>
/// </remarks>
public sealed class Currency : IEquatable<Currency>
{
    private const int DefaultMinorUnits = 2;

    private static readonly FrozenDictionary<string, int> MinorUnitExceptions =
        new Dictionary<string, int>(StringComparer.Ordinal)
        {
            // Excepción del proyecto, no de ISO: el peso colombiano se opera
            // sin centavos (HANDOFF.md §1).
            ["COP"] = 0,
            ["JPY"] = 0,
            ["KRW"] = 0,
            ["CLP"] = 0,
            ["VND"] = 0,
            ["ISK"] = 0,
            ["PYG"] = 0,
            ["XAF"] = 0,
            ["XOF"] = 0,
            ["XPF"] = 0,
            ["UGX"] = 0,
            ["RWF"] = 0,
            ["BHD"] = 3,
            ["KWD"] = 3,
            ["OMR"] = 3,
            ["TND"] = 3,
            ["JOD"] = 3,
        }.ToFrozenDictionary(StringComparer.Ordinal);

    private Currency(string code, int minorUnits)
    {
        Code = code;
        MinorUnits = minorUnits;
    }

    /// <summary>Código ISO de tres letras en mayúsculas.</summary>
    public string Code { get; }

    /// <summary>Decimales significativos de la moneda (0, 2 o 3).</summary>
    public int MinorUnits { get; }

    public static Currency Cop { get; } = Of("COP");

    public static Currency Usd { get; } = Of("USD");

    public static Currency Eur { get; } = Of("EUR");

    /// <summary>Crea o resuelve una moneda por su código ISO.</summary>
    public static Currency Of(string code)
    {
        var normalized = Guard.NotBlank(code).ToUpperInvariant();
        Guard.Require(
            normalized.Length == 3 && normalized.All(char.IsAsciiLetterUpper),
            DomainErrorCodes.InvalidCurrency,
            $"'{code}' no es un código de moneda ISO 4217 válido (tres letras).");

        var minorUnits = MinorUnitExceptions.TryGetValue(normalized, out var units)
            ? units
            : DefaultMinorUnits;

        return new Currency(normalized, minorUnits);
    }

    /// <summary>
    /// Moneda con decimales explícitos, para casos fuera de la tabla ISO
    /// (criptomonedas o unidades internas). El llamador asume la política.
    /// </summary>
    public static Currency Custom(string code, int minorUnits)
    {
        var currency = Of(code);
        Guard.InRange(minorUnits, 0, 8, nameof(minorUnits));
        return new Currency(currency.Code, minorUnits);
    }

    public bool Equals(Currency? other) =>
        other is not null && string.Equals(Code, other.Code, StringComparison.Ordinal);

    public override bool Equals(object? obj) => Equals(obj as Currency);

    public override int GetHashCode() => StringComparer.Ordinal.GetHashCode(Code);

    public override string ToString() => Code;

    public static bool operator ==(Currency? left, Currency? right) =>
        left is null ? right is null : left.Equals(right);

    public static bool operator !=(Currency? left, Currency? right) => !(left == right);
}
