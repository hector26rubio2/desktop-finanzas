using Finanzas.Domain.Common;
using Finanzas.Domain.Identifiers;
using Finanzas.Domain.Organizations;

namespace Finanzas.Domain.Tests;

/// <summary>
/// Membresías: la unidad de autorización. Lo que se prueba aquí no es "quién es
/// admin" sino qué puede hacer una persona ahora mismo.
/// </summary>
public class MembershipTests
{
    private static readonly OrganizationId Casa = OrganizationId.New();
    private static readonly UserId Hector = UserId.New();

    private static Membership Activa(Capability capacidades = CapabilitySets.Contributor) =>
        Membership.Create(MembershipId.New(), Casa, Hector, capacidades, Given.Now);

    [Fact]
    public void Una_membresia_activa_puede_lo_que_declara()
    {
        var membresia = Activa();

        Assert.True(membresia.Can(Capability.RecordMovements));
        Assert.True(membresia.Can(Capability.ViewLedger | Capability.ManageCards));
        Assert.Equal(MembershipStatus.Active, membresia.Status);
    }

    [Fact]
    public void Lo_que_no_esta_en_el_conjunto_no_se_puede()
    {
        var membresia = Activa(CapabilitySets.Contributor);

        Assert.False(membresia.Can(Capability.ManageMembers));

        var error = Assert.Throws<InvariantViolationException>(
            () => membresia.EnsureCan(Capability.ManageMembers));

        Assert.Equal(DomainErrorCodes.MembershipCapabilityMissing, error.Code);
    }

    [Fact]
    public void Pedir_varias_capacidades_exige_todas_no_alguna()
    {
        var membresia = Activa(Capability.ViewLedger);

        Assert.False(membresia.Can(Capability.ViewLedger | Capability.RecordMovements));
    }

    [Fact]
    public void Una_invitacion_pendiente_todavia_no_puede_nada()
    {
        var membresia = Membership.Invite(
            MembershipId.New(),
            Casa,
            Hector,
            CapabilitySets.Owner,
            Given.Now);

        Assert.Equal(Capability.None, membresia.EffectiveCapabilities);
        Assert.False(membresia.Can(Capability.ViewLedger));

        membresia.Accept();

        Assert.True(membresia.Can(Capability.ViewLedger));
    }

    [Fact]
    public void Suspender_corta_el_acceso_sin_borrar_lo_que_tenia()
    {
        var membresia = Activa(CapabilitySets.Owner);

        membresia.Suspend();

        Assert.Equal(Capability.None, membresia.EffectiveCapabilities);
        Assert.False(membresia.Can(Capability.ViewLedger));

        // Las capacidades escritas siguen ahí: reactivar devuelve exactamente
        // lo que la persona tenía, sin que nadie tenga que acordarse.
        Assert.Equal(CapabilitySets.Owner, membresia.Capabilities);

        membresia.Reinstate();

        Assert.Equal(CapabilitySets.Owner, membresia.EffectiveCapabilities);
    }

    [Fact]
    public void No_existe_la_membresia_sin_ninguna_capacidad()
    {
        var error = Assert.Throws<InvariantViolationException>(
            () => Membership.Create(MembershipId.New(), Casa, Hector, Capability.None, Given.Now));

        Assert.Equal(DomainErrorCodes.MembershipWithoutCapabilities, error.Code);
    }

    [Fact]
    public void Quitar_la_ultima_capacidad_obliga_a_suspender_o_retirar()
    {
        var membresia = Activa(Capability.ViewLedger);

        var error = Assert.Throws<InvariantViolationException>(
            () => membresia.Revoke(Capability.ViewLedger));

        Assert.Equal(DomainErrorCodes.MembershipWithoutCapabilities, error.Code);
        Assert.Equal(Capability.ViewLedger, membresia.EffectiveCapabilities);
    }

    [Fact]
    public void Conceder_algo_que_ya_se_tiene_no_es_un_error()
    {
        var membresia = Activa(Capability.ViewLedger);

        membresia.Grant(Capability.ViewLedger);
        membresia.Grant(Capability.RecordMovements);

        Assert.Equal(Capability.ViewLedger | Capability.RecordMovements, membresia.Capabilities);
    }

    [Fact]
    public void Aceptar_dos_veces_falla_en_vez_de_pasar_por_alto()
    {
        var membresia = Membership.Invite(MembershipId.New(), Casa, Hector, CapabilitySets.Viewer, Given.Now);
        membresia.Accept();

        var error = Assert.Throws<InvariantViolationException>(membresia.Accept);

        Assert.Equal(DomainErrorCodes.MembershipNotInvited, error.Code);
    }

    [Fact]
    public void El_conjunto_de_solo_lectura_no_deja_registrar_dinero()
    {
        var membresia = Activa(CapabilitySets.Viewer);

        Assert.True(membresia.Can(Capability.ViewLedger));
        Assert.False(membresia.Can(Capability.RecordMovements));
        Assert.False(membresia.Can(Capability.ExportData));
    }

    [Fact]
    public void El_conjunto_de_uso_diario_no_gobierna_la_organizacion()
    {
        var membresia = Activa(CapabilitySets.Contributor);

        Assert.True(membresia.Can(Capability.RecordMovements));
        Assert.True(membresia.Can(Capability.IssueSettlements));
        Assert.False(membresia.Can(Capability.ManageMembers));
        Assert.False(membresia.Can(Capability.ManageOrganization));
    }

    [Fact]
    public void Los_bits_de_las_capacidades_son_contrato_de_persistencia()
    {
        // Se guardan como entero. Cambiar un valor reinterpreta las membresías
        // ya escritas: quien tenía "ver" pasaría a tener otra cosa sin que nadie
        // haya tocado sus permisos.
        Assert.Equal(1, (int)Capability.ViewLedger);
        Assert.Equal(2, (int)Capability.RecordMovements);
        Assert.Equal(4, (int)Capability.ManageAccounts);
        Assert.Equal(8, (int)Capability.ManageCards);
        Assert.Equal(16, (int)Capability.ManagePeople);
        Assert.Equal(32, (int)Capability.ManageInvestments);
        Assert.Equal(64, (int)Capability.ManageRecurrences);
        Assert.Equal(128, (int)Capability.IssueSettlements);
        Assert.Equal(256, (int)Capability.ExportData);
        Assert.Equal(512, (int)Capability.ManageMembers);
        Assert.Equal(1024, (int)Capability.ManageOrganization);
    }
}
