using Finanzas.Domain.Common;
using Finanzas.Domain.Identifiers;

namespace Finanzas.Domain.Organizations;

/// <summary>Situación de una membresía.</summary>
public enum MembershipStatus
{
    /// <summary>Invitada: aún no ha aceptado y todavía no puede hacer nada.</summary>
    Invited = 1,

    Active = 2,

    /// <summary>Suspendida: conserva sus capacidades escritas, pero ninguna surte efecto.</summary>
    Suspended = 3,
}

/// <summary>
/// Vínculo entre una persona y una organización, con lo que puede hacer dentro.
/// Es la unidad de autorización del sistema.
/// </summary>
/// <remarks>
/// <para><b>Capacidades efectivas.</b> Lo que se consulta es
/// <see cref="EffectiveCapabilities"/>, no <see cref="Capabilities"/>. Una
/// membresía invitada o suspendida no tiene ninguna, aunque las tenga escritas:
/// suspender debe cortar el acceso sin borrar qué tenía la persona, para poder
/// devolvérselo tal cual al reactivarla.</para>
/// <para><b>Una membresía sin capacidades no existe.</b> Quitar la última no
/// deja a alguien "dentro sin permisos", que es un estado que nadie revisa;
/// obliga a decidir entre suspender o expulsar.</para>
/// <para>Lo que este agregado <b>no</b> puede garantizar es que una organización
/// conserve al menos un miembro con <see cref="Capability.ManageMembers"/>: eso
/// mira a todas las membresías a la vez y lo comprueba la capa de aplicación
/// antes de suspender o rebajar la última.</para>
/// </remarks>
public sealed class Membership : AggregateRoot<MembershipId>
{
    private Membership(
        MembershipId id,
        OrganizationId organization,
        UserId user,
        Capability capabilities,
        MembershipStatus status,
        DateTimeOffset createdAt)
        : base(id)
    {
        Organization = organization;
        User = user;
        Capabilities = capabilities;
        Status = status;
        CreatedAt = createdAt;
    }

    public OrganizationId Organization { get; }

    public UserId User { get; }

    /// <summary>Capacidades escritas, surtan efecto o no.</summary>
    public Capability Capabilities { get; private set; }

    public MembershipStatus Status { get; private set; }

    public DateTimeOffset CreatedAt { get; }

    /// <summary>
    /// Lo que la persona puede hacer ahora mismo. Es lo único contra lo que se
    /// autoriza.
    /// </summary>
    public Capability EffectiveCapabilities =>
        Status == MembershipStatus.Active ? Capabilities : Capability.None;

    public static Membership Invite(
        MembershipId id,
        OrganizationId organization,
        UserId user,
        Capability capabilities,
        DateTimeOffset createdAt) =>
        new(id, organization, user, Require(capabilities), MembershipStatus.Invited, createdAt);

    /// <summary>Alta directa y activa, para el dueño que crea la organización.</summary>
    public static Membership Create(
        MembershipId id,
        OrganizationId organization,
        UserId user,
        Capability capabilities,
        DateTimeOffset createdAt) =>
        new(id, organization, user, Require(capabilities), MembershipStatus.Active, createdAt);

    /// <summary>La persona acepta la invitación.</summary>
    public void Accept()
    {
        Guard.Require(
            Status == MembershipStatus.Invited,
            DomainErrorCodes.MembershipNotInvited,
            $"Solo se acepta una invitación pendiente; esta membresía está {Status}.");

        Status = MembershipStatus.Active;
    }

    public void Suspend()
    {
        Guard.Require(
            Status != MembershipStatus.Suspended,
            DomainErrorCodes.MembershipAlreadySuspended,
            "La membresía ya está suspendida.");

        Status = MembershipStatus.Suspended;
    }

    /// <summary>Reactiva una membresía suspendida con las capacidades que ya tenía.</summary>
    public void Reinstate()
    {
        Guard.Require(
            Status == MembershipStatus.Suspended,
            DomainErrorCodes.MembershipNotSuspended,
            $"Solo se reactiva una membresía suspendida; esta está {Status}.");

        Status = MembershipStatus.Active;
    }

    /// <summary>Reemplaza el conjunto completo de capacidades.</summary>
    public void ChangeCapabilities(Capability capabilities) => Capabilities = Require(capabilities);

    /// <summary>Añade capacidades. Conceder algo que ya se tiene no es un error.</summary>
    public void Grant(Capability capabilities) => Capabilities |= capabilities;

    /// <summary>
    /// Retira capacidades. Quitar la última obliga a decidir: suspender o
    /// expulsar, no dejar a alguien dentro sin poder hacer nada.
    /// </summary>
    public void Revoke(Capability capabilities)
    {
        var remaining = Capabilities & ~capabilities;

        Guard.Require(
            remaining != Capability.None,
            DomainErrorCodes.MembershipWithoutCapabilities,
            "Quitar la última capacidad dejaría una membresía sin uso: suspéndala o retírela.");

        Capabilities = remaining;
    }

    /// <summary>La persona puede hacer <b>todo</b> lo que se le pregunta, ahora mismo.</summary>
    public bool Can(Capability required) => (EffectiveCapabilities & required) == required;

    /// <summary>
    /// Exige la capacidad y falla con código estable si falta. Es el punto por
    /// el que pasa toda autorización: quien no lo llame, no autoriza.
    /// </summary>
    public void EnsureCan(Capability required) =>
        Guard.Require(
            Can(required),
            DomainErrorCodes.MembershipCapabilityMissing,
            $"La membresía no tiene la capacidad {required & ~EffectiveCapabilities}.");

    private static Capability Require(Capability capabilities)
    {
        Guard.Require(
            capabilities != Capability.None,
            DomainErrorCodes.MembershipWithoutCapabilities,
            "Una membresía sin ninguna capacidad no tiene sentido: no la cree.");

        return capabilities;
    }

    public override string ToString() => $"{User} en {Organization} [{Status}] {EffectiveCapabilities}";
}
