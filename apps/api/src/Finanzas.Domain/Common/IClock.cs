namespace Finanzas.Domain.Common;

/// <summary>
/// Reloj inyectable. El dominio nunca llama a <c>DateTime.Now</c>: las fechas
/// entran como dato para que las invariantes sean deterministas y testeables.
/// </summary>
public interface IClock
{
    DateTimeOffset Now { get; }

    DateOnly Today => DateOnly.FromDateTime(Now.LocalDateTime);
}

/// <summary>Reloj del sistema. Solo lo usa la composición, no el dominio.</summary>
public sealed class SystemClock : IClock
{
    public static readonly SystemClock Instance = new();

    public DateTimeOffset Now => DateTimeOffset.Now;
}
