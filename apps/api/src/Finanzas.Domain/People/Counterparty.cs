using Finanzas.Domain.Common;
using Finanzas.Domain.Identifiers;

namespace Finanzas.Domain.People;

/// <summary>
/// Persona o contraparte reutilizable (§W11). Es la misma entidad para
/// "le presté", "me prestó" y "esta compra es suya": no hay una lista de
/// deudores separada de una de acreedores.
/// </summary>
public sealed class Counterparty : AggregateRoot<CounterpartyId>
{
    private Counterparty(
        CounterpartyId id,
        string displayName,
        string? alias,
        string? email,
        string? phone,
        string? notes,
        DateTimeOffset createdAt)
        : base(id)
    {
        DisplayName = displayName;
        Alias = alias;
        Email = email;
        Phone = phone;
        Notes = notes;
        CreatedAt = createdAt;
        IsActive = true;
    }

    public string DisplayName { get; private set; }

    public string? Alias { get; private set; }

    public string? Email { get; private set; }

    public string? Phone { get; private set; }

    public string? Notes { get; private set; }

    public bool IsActive { get; private set; }

    public DateTimeOffset CreatedAt { get; }

    public static Counterparty Create(
        CounterpartyId id,
        string displayName,
        DateTimeOffset createdAt,
        string? alias = null,
        string? email = null,
        string? phone = null,
        string? notes = null) =>
        new(
            id,
            Guard.NotBlank(displayName),
            Trim(alias),
            NormalizeEmail(email),
            Trim(phone),
            Trim(notes),
            createdAt);

    public void Rename(string displayName, string? alias)
    {
        DisplayName = Guard.NotBlank(displayName);
        Alias = Trim(alias);
    }

    public void UpdateContact(string? email, string? phone)
    {
        Email = NormalizeEmail(email);
        Phone = Trim(phone);
    }

    public void UpdateNotes(string? notes) => Notes = Trim(notes);

    /// <summary>
    /// Desactiva la contraparte. No borra nada: sus obligaciones y movimientos
    /// siguen existiendo y liquidándose.
    /// </summary>
    public void Deactivate() => IsActive = false;

    public void Activate() => IsActive = true;

    private static string? Trim(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static string? NormalizeEmail(string? email)
    {
        var value = Trim(email);
        if (value is null)
        {
            return null;
        }

        Guard.Require(
            value.Count(c => c == '@') == 1 && value.Length >= 3 && !value.StartsWith('@') && !value.EndsWith('@'),
            DomainErrorCodes.OutOfRange,
            $"'{email}' no parece un correo electrónico.");

        return value.ToLowerInvariant();
    }

    public override string ToString() => Alias is null ? DisplayName : $"{DisplayName} ({Alias})";
}
