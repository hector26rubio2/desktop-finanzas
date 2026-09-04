namespace Finanzas.Contracts.Identity;

/// <summary>
/// Lo que una persona puede hacer dentro de una organización. Espejo de
/// <c>Finanzas.Domain.Organizations.Capability</c>.
/// </summary>
/// <remarks>
/// <para>El cliente <b>no</b> decide la autorización: la decide el servidor y la
/// repite en cada petición. Estas banderas sirven para no ofrecer un botón que
/// va a fallar, no para proteger nada. Ocultar una acción en la interfaz no
/// impide llamarla.</para>
/// <para>Los valores son potencias de dos y son contrato: se guardan como
/// entero. Un bit retirado no se reutiliza jamás.</para>
/// </remarks>
public enum CapabilityDto
{
    None = 0,
    ViewLedger = 1,
    RecordMovements = 2,
    ManageAccounts = 4,
    ManageCards = 8,
    ManagePeople = 16,
    ManageInvestments = 32,
    ManageRecurrences = 64,
    IssueSettlements = 128,
    ExportData = 256,
    ManageMembers = 512,
    ManageOrganization = 1024,
}

/// <summary>
/// Situación de una membresía. Espejo de
/// <c>Finanzas.Domain.Organizations.MembershipStatus</c>.
/// </summary>
public enum MembershipStatusDto
{
    Invited = 1,
    Active = 2,
    Suspended = 3,
}

/// <summary>Organización: la frontera de aislamiento de los datos.</summary>
/// <param name="Id">Identificador de la organización.</param>
/// <param name="Name">Nombre visible.</param>
/// <param name="Slug">Identificador legible, en minúsculas y único.</param>
/// <param name="BaseCurrency">
/// Moneda en la que se expresan todos los totales. No cambia: los importes ya
/// registrados guardan su equivalente en ella.
/// </param>
/// <param name="IsActive">Sigue en uso.</param>
/// <param name="CreatedAt">Instante de creación.</param>
public sealed record OrganizationDto(
    Guid Id,
    string Name,
    string Slug,
    string BaseCurrency,
    bool IsActive,
    DateTimeOffset CreatedAt);

/// <summary>Persona que puede entrar al sistema.</summary>
/// <remarks>No lleva credenciales, ni las llevará: la autenticación vive fuera del contrato.</remarks>
/// <param name="Id">Identificador de la persona.</param>
/// <param name="DisplayName">Nombre visible.</param>
/// <param name="Email">Correo, normalizado en minúsculas.</param>
/// <param name="IsActive">Sigue en uso.</param>
public sealed record UserDto(Guid Id, string DisplayName, string Email, bool IsActive);

/// <summary>Vínculo entre una persona y una organización.</summary>
/// <remarks>
/// <see cref="EffectiveCapabilities"/> es lo que la persona puede hacer ahora;
/// <see cref="Capabilities"/> es lo que tiene escrito. En una membresía
/// suspendida o invitada, el primero está vacío y el segundo no: así la interfaz
/// puede mostrar qué recuperará al reactivarla.
/// </remarks>
/// <param name="Id">Identificador de la membresía.</param>
/// <param name="User">Persona vinculada.</param>
/// <param name="Organization">Organización a la que pertenece.</param>
/// <param name="Status">Situación de la membresía.</param>
/// <param name="Capabilities">Capacidades escritas.</param>
/// <param name="EffectiveCapabilities">Capacidades que surten efecto ahora.</param>
/// <param name="CreatedAt">Instante de creación.</param>
public sealed record MembershipDto(
    Guid Id,
    UserDto User,
    Guid Organization,
    MembershipStatusDto Status,
    IReadOnlyList<CapabilityDto> Capabilities,
    IReadOnlyList<CapabilityDto> EffectiveCapabilities,
    DateTimeOffset CreatedAt);

/// <summary>
/// Sesión: quién está usando el sistema, en qué organización y con qué puede.
/// </summary>
/// <remarks>
/// <para><b>La organización no viaja en cada DTO.</b> Va aquí, una vez. Un
/// movimiento o una cuenta no llevan el identificador de organización porque
/// nunca se consultan fuera de una sesión: el servidor acota cada consulta a la
/// organización activa, y ese aislamiento no depende de que el cliente envíe el
/// campo correcto.</para>
/// <para><see cref="Organizations"/> lista las demás organizaciones de la
/// persona, para poder cambiar de una a otra.</para>
/// </remarks>
/// <param name="User">Persona autenticada.</param>
/// <param name="Organization">Organización activa.</param>
/// <param name="Capabilities">Lo que puede hacer en ella, ahora mismo.</param>
/// <param name="Organizations">Otras organizaciones donde tiene membresía activa.</param>
/// <param name="ExpiresAt">Instante en que la sesión deja de valer.</param>
public sealed record SessionDto(
    UserDto User,
    OrganizationDto Organization,
    IReadOnlyList<CapabilityDto> Capabilities,
    IReadOnlyList<OrganizationDto> Organizations,
    DateTimeOffset ExpiresAt);

/// <summary>Alta de una organización.</summary>
/// <remarks>
/// Quien la crea queda con una membresía activa y todas las capacidades: una
/// organización sin nadie que la gobierne no se puede administrar después.
/// </remarks>
/// <param name="Name">Nombre visible.</param>
/// <param name="Slug">Identificador legible. Se normaliza a minúsculas.</param>
/// <param name="BaseCurrency">Código ISO de la moneda base. No podrá cambiarse.</param>
public sealed record CreateOrganizationRequest(string Name, string Slug, string BaseCurrency);

/// <summary>Invitación de una persona a la organización activa.</summary>
/// <param name="Email">Correo de la persona invitada.</param>
/// <param name="DisplayName">Nombre visible, si la persona aún no existe.</param>
/// <param name="Capabilities">Capacidades con las que entrará. No puede ir vacío.</param>
public sealed record InviteMemberRequest(
    string Email,
    string? DisplayName,
    IReadOnlyList<CapabilityDto> Capabilities);

/// <summary>Cambio del conjunto de capacidades de una membresía.</summary>
/// <remarks>
/// Reemplaza el conjunto completo, no añade. Vaciarlo es un error: para retirar
/// el acceso se suspende la membresía, que conserva lo que la persona tenía.
/// </remarks>
/// <param name="Capabilities">Conjunto completo de capacidades.</param>
public sealed record ChangeMemberCapabilitiesRequest(IReadOnlyList<CapabilityDto> Capabilities);
