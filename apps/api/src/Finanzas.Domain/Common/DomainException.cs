namespace Finanzas.Domain.Common;

/// <summary>
/// Error de dominio. Siempre lleva un <see cref="Code"/> estable de
/// <see cref="DomainErrorCodes"/> para que la capa de contratos lo traduzca sin
/// depender del texto del mensaje.
/// </summary>
public class DomainException : Exception
{
    public DomainException(string code, string message)
        : base(message)
    {
        Code = code;
    }

    public string Code { get; }
}

/// <summary>Una invariante del modelo fue violada.</summary>
public sealed class InvariantViolationException : DomainException
{
    public InvariantViolationException(string code, string message)
        : base(code, message)
    {
    }
}

/// <summary>
/// Se intentó operar con dos importes de monedas distintas sin conversión
/// explícita (regla financiera 5 del handoff).
/// </summary>
public sealed class CurrencyMismatchException : DomainException
{
    public CurrencyMismatchException(string left, string right)
        : base(
            DomainErrorCodes.CurrencyMismatch,
            $"No se pueden combinar importes en '{left}' y '{right}' sin una conversión explícita.")
    {
        Left = left;
        Right = right;
    }

    public string Left { get; }

    public string Right { get; }
}
