using System.Runtime.CompilerServices;

namespace Finanzas.Domain.Common;

/// <summary>
/// Comprobaciones de invariantes. Toda violación produce una
/// <see cref="DomainException"/> con código estable; nunca un
/// <c>ArgumentException</c> de la BCL, que no viaja bien hacia el contrato.
/// </summary>
public static class Guard
{
    public static void Require(bool condition, string code, string message)
    {
        if (!condition)
        {
            throw new InvariantViolationException(code, message);
        }
    }

    public static T NotNull<T>(T? value, [CallerArgumentExpression(nameof(value))] string? name = null)
        where T : class
    {
        if (value is null)
        {
            throw new InvariantViolationException(
                DomainErrorCodes.RequiredValue,
                $"'{name}' es obligatorio.");
        }

        return value;
    }

    public static string NotBlank(string? value, [CallerArgumentExpression(nameof(value))] string? name = null)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new InvariantViolationException(
                DomainErrorCodes.RequiredValue,
                $"'{name}' no puede estar vacío.");
        }

        return value.Trim();
    }

    public static decimal Positive(decimal value, string code, [CallerArgumentExpression(nameof(value))] string? name = null)
    {
        if (value <= 0m)
        {
            throw new InvariantViolationException(code, $"'{name}' debe ser mayor que cero (recibido {value}).");
        }

        return value;
    }

    public static decimal NonNegative(decimal value, string code, [CallerArgumentExpression(nameof(value))] string? name = null)
    {
        if (value < 0m)
        {
            throw new InvariantViolationException(code, $"'{name}' no puede ser negativo (recibido {value}).");
        }

        return value;
    }

    public static int InRange(int value, int min, int max, [CallerArgumentExpression(nameof(value))] string? name = null)
    {
        if (value < min || value > max)
        {
            throw new InvariantViolationException(
                DomainErrorCodes.OutOfRange,
                $"'{name}' debe estar entre {min} y {max} (recibido {value}).");
        }

        return value;
    }
}
