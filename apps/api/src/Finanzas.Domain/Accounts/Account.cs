using Finanzas.Domain.Common;
using Finanzas.Domain.Identifiers;
using Finanzas.Domain.ValueObjects;

namespace Finanzas.Domain.Accounts;

/// <summary>Naturaleza de la cuenta.</summary>
/// <remarks>
/// No existe <c>Credit</c>: una tarjeta de crédito no es una cuenta con saldo
/// negativo sino un agregado propio con cupo, corte, APR y pago mínimo
/// (<see cref="Cards.CreditCard"/>). Mezclarlas fue el defecto del esquema
/// heredado.
/// </remarks>
public enum AccountKind
{
    Cash = 1,
    Checking = 2,
    Savings = 3,
    Wallet = 4,
    Other = 99,
}

/// <summary>
/// Cuenta de dinero propio. Guarda la <b>definición</b>; el saldo se deriva del
/// ledger de movimientos y nunca se almacena (regla financiera 1).
/// </summary>
public sealed class Account : AggregateRoot<AccountId>
{
    private Account(
        AccountId id,
        string name,
        AccountKind kind,
        Currency currency,
        string? institution,
        string? lastFour,
        DateTimeOffset createdAt)
        : base(id)
    {
        Name = name;
        Kind = kind;
        Currency = currency;
        Institution = institution;
        LastFour = lastFour;
        CreatedAt = createdAt;
        IsActive = true;
    }

    public string Name { get; private set; }

    public AccountKind Kind { get; }

    /// <summary>Moneda de la cuenta. No cambia: cambiarla reescribiría el pasado.</summary>
    public Currency Currency { get; }

    public string? Institution { get; private set; }

    public string? LastFour { get; private set; }

    public bool IsDefault { get; private set; }

    public bool IsActive { get; private set; }

    public DateTimeOffset CreatedAt { get; }

    public static Account Create(
        AccountId id,
        string name,
        AccountKind kind,
        Currency currency,
        DateTimeOffset createdAt,
        string? institution = null,
        string? lastFour = null)
    {
        Guard.NotNull(currency);
        var normalizedLastFour = NormalizeLastFour(lastFour);

        return new Account(
            id,
            Guard.NotBlank(name),
            kind,
            currency,
            string.IsNullOrWhiteSpace(institution) ? null : institution.Trim(),
            normalizedLastFour,
            createdAt);
    }

    public void Rename(string name) => Name = Guard.NotBlank(name);

    public void UpdateDetails(string? institution, string? lastFour)
    {
        Institution = string.IsNullOrWhiteSpace(institution) ? null : institution.Trim();
        LastFour = NormalizeLastFour(lastFour);
    }

    public void MarkAsDefault() => IsDefault = true;

    public void ClearDefault() => IsDefault = false;

    public void Deactivate()
    {
        // Desactivar no borra: el histórico del ledger sigue siendo válido
        // (§W10 del plan, "no borrar datos al retirar vistas").
        IsActive = false;
        IsDefault = false;
    }

    public void Activate() => IsActive = true;

    private static string? NormalizeLastFour(string? lastFour)
    {
        if (string.IsNullOrWhiteSpace(lastFour))
        {
            return null;
        }

        var trimmed = lastFour.Trim();
        Guard.Require(
            trimmed.Length == 4 && trimmed.All(char.IsAsciiDigit),
            DomainErrorCodes.OutOfRange,
            $"'{lastFour}' no son cuatro dígitos.");
        return trimmed;
    }

    public override string ToString() => $"{Name} ({Currency.Code})";
}
