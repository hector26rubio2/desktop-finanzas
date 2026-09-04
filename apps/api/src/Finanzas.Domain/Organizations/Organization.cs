using Finanzas.Domain.Common;
using Finanzas.Domain.Identifiers;
using Finanzas.Domain.ValueObjects;

namespace Finanzas.Domain.Organizations;

/// <summary>
/// Organización: la frontera de aislamiento de los datos. Cuentas, movimientos,
/// tarjetas, personas y liquidaciones pertenecen a una y solo una.
/// </summary>
/// <remarks>
/// <para><b>La moneda base no se cambia.</b> No hay método para ello, y la
/// ausencia es la invariante: todo importe convertido del ledger guarda su
/// equivalente en la moneda base vigente cuando se registró. Cambiarla después
/// reinterpretaría en otra unidad cifras ya escritas, sin tocarlas y sin dejar
/// rastro. Si hiciera falta, es una migración con conversión explícita de cada
/// movimiento, no un campo editable (regla financiera 5).</para>
/// <para><b>El aislamiento no vive aquí.</b> Esta clase no sabe qué datos le
/// pertenecen: lo garantiza la capa de persistencia, que exige la organización
/// en cada consulta. Ver <c>HANDOFF.md</c> §7.</para>
/// </remarks>
public sealed class Organization : AggregateRoot<OrganizationId>
{
    private Organization(
        OrganizationId id,
        string name,
        string slug,
        Currency baseCurrency,
        DateTimeOffset createdAt)
        : base(id)
    {
        Name = name;
        Slug = slug;
        BaseCurrency = baseCurrency;
        IsActive = true;
        CreatedAt = createdAt;
    }

    public string Name { get; private set; }

    /// <summary>
    /// Identificador legible y estable, en minúsculas. Es único entre
    /// organizaciones, y esa unicidad la impone la base de datos: el agregado
    /// solo puede garantizar la forma.
    /// </summary>
    public string Slug { get; }

    /// <summary>
    /// Moneda en la que se expresan todos los totales de la organización.
    /// Inmutable.
    /// </summary>
    public Currency BaseCurrency { get; }

    public bool IsActive { get; private set; }

    public DateTimeOffset CreatedAt { get; }

    public static Organization Create(
        OrganizationId id,
        string name,
        string slug,
        Currency baseCurrency,
        DateTimeOffset createdAt)
    {
        Guard.NotNull(baseCurrency);

        return new Organization(
            id,
            Guard.NotBlank(name),
            NormalizeSlug(slug),
            baseCurrency,
            createdAt);
    }

    public void Rename(string name) => Name = Guard.NotBlank(name);

    /// <summary>
    /// Archiva la organización. No borra nada: los datos siguen ahí y dejan de
    /// ser accesibles.
    /// </summary>
    public void Deactivate() => IsActive = false;

    public void Activate() => IsActive = true;

    /// <summary>
    /// Minúsculas, sin espacios en los extremos y solo con letras, dígitos y
    /// guiones. Un <c>slug</c> con mayúsculas o espacios acaba en una URL o en
    /// una comparación que falla según quién la escriba.
    /// </summary>
    private static string NormalizeSlug(string slug)
    {
        var normalized = Guard.NotBlank(slug).ToLowerInvariant();

        Guard.Require(
            normalized.All(c => char.IsAsciiLetterOrDigit(c) || c == '-'),
            DomainErrorCodes.OrganizationInvalidSlug,
            $"El identificador '{slug}' solo admite letras, dígitos y guiones.");

        Guard.Require(
            normalized[0] != '-' && normalized[^1] != '-',
            DomainErrorCodes.OrganizationInvalidSlug,
            $"El identificador '{slug}' no puede empezar ni terminar en guion.");

        return normalized;
    }

    public override string ToString() => $"{Name} ({Slug}, {BaseCurrency.Code})";
}

/// <summary>
/// Persona que puede entrar al sistema. No guarda credenciales: la autenticación
/// vive fuera del dominio y aquí solo importa a quién se le atribuyen los actos.
/// </summary>
public sealed class User : AggregateRoot<UserId>
{
    private User(UserId id, string displayName, string email, DateTimeOffset createdAt)
        : base(id)
    {
        DisplayName = displayName;
        Email = email;
        IsActive = true;
        CreatedAt = createdAt;
    }

    public string DisplayName { get; private set; }

    /// <summary>Correo normalizado en minúsculas. Es la clave natural de la persona.</summary>
    public string Email { get; private set; }

    public bool IsActive { get; private set; }

    public DateTimeOffset CreatedAt { get; }

    public static User Create(UserId id, string displayName, string email, DateTimeOffset createdAt) =>
        new(id, Guard.NotBlank(displayName), NormalizeEmail(email), createdAt);

    public void Rename(string displayName) => DisplayName = Guard.NotBlank(displayName);

    public void ChangeEmail(string email) => Email = NormalizeEmail(email);

    /// <summary>
    /// Desactiva la persona. Sus movimientos siguen atribuidos a ella: borrar al
    /// autor de un asiento es perder la auditoría.
    /// </summary>
    public void Deactivate() => IsActive = false;

    public void Activate() => IsActive = true;

    private static string NormalizeEmail(string email)
    {
        var normalized = Guard.NotBlank(email).ToLowerInvariant();

        // Comprobación mínima y deliberada: validar correos con expresiones
        // regulares elaboradas rechaza direcciones legítimas. Que llegue es cosa
        // del envío, no del dominio.
        var at = normalized.IndexOf('@');
        Guard.Require(
            at > 0 && at < normalized.Length - 1 && normalized.Count(c => c == '@') == 1,
            DomainErrorCodes.UserInvalidEmail,
            $"'{email}' no parece un correo electrónico.");

        return normalized;
    }

    public override string ToString() => $"{DisplayName} <{Email}>";
}
