using Finanzas.Domain.Common;
using Finanzas.Domain.Identifiers;
using Finanzas.Domain.Organizations;
using Finanzas.Domain.ValueObjects;

namespace Finanzas.Domain.Tests;

/// <summary>
/// Organización y persona: la frontera de aislamiento y a quién se le atribuyen
/// los actos.
/// </summary>
public class OrganizationTests
{
    private static Organization Casa(string slug = "casa") =>
        Organization.Create(OrganizationId.New(), "Finanzas de casa", slug, Given.Cop, Given.Now);

    [Fact]
    public void Una_organizacion_nace_activa_y_con_moneda_base()
    {
        var organizacion = Casa();

        Assert.True(organizacion.IsActive);
        Assert.Equal(Given.Cop, organizacion.BaseCurrency);
        Assert.Equal("casa", organizacion.Slug);
    }

    [Fact]
    public void La_moneda_base_no_se_puede_cambiar()
    {
        // No es una prueba de comportamiento sino de superficie: si algún día
        // aparece un método para cambiarla, esta prueba obliga a justificarlo.
        // Todo importe convertido guarda su equivalente en la moneda base
        // vigente al registrarlo; cambiarla reinterpretaría cifras ya escritas.
        var cambiadores = typeof(Organization)
            .GetMethods()
            .Where(m => m.Name.Contains("Currency", StringComparison.Ordinal) && m.Name != "get_BaseCurrency")
            .Select(m => m.Name)
            .ToArray();

        Assert.Empty(cambiadores);
    }

    [Theory]
    [InlineData("Casa")]
    [InlineData("  casa  ")]
    public void El_identificador_legible_se_normaliza_a_minusculas_y_sin_espacios(string slug)
    {
        Assert.Equal("casa", Casa(slug).Slug);
    }

    [Theory]
    [InlineData("casa mia")]
    [InlineData("casa_mia")]
    [InlineData("-casa")]
    [InlineData("casa-")]
    public void Un_identificador_legible_mal_formado_se_rechaza(string slug)
    {
        var error = Assert.Throws<InvariantViolationException>(() => Casa(slug));

        Assert.Equal(DomainErrorCodes.OrganizationInvalidSlug, error.Code);
    }

    [Fact]
    public void Archivar_una_organizacion_no_borra_nada()
    {
        var organizacion = Casa();

        organizacion.Deactivate();

        Assert.False(organizacion.IsActive);
        Assert.Equal("Finanzas de casa", organizacion.Name);
    }

    [Fact]
    public void El_correo_de_una_persona_se_normaliza()
    {
        var persona = User.Create(UserId.New(), "Héctor", "  Hector@Example.COM ", Given.Now);

        Assert.Equal("hector@example.com", persona.Email);
    }

    [Theory]
    [InlineData("sin-arroba")]
    [InlineData("@example.com")]
    [InlineData("hector@")]
    [InlineData("dos@arrobas@example.com")]
    public void Un_correo_mal_formado_se_rechaza(string email)
    {
        var error = Assert.Throws<InvariantViolationException>(
            () => User.Create(UserId.New(), "Héctor", email, Given.Now));

        Assert.Equal(DomainErrorCodes.UserInvalidEmail, error.Code);
    }

    [Fact]
    public void Desactivar_una_persona_no_desliga_lo_que_registro()
    {
        var persona = User.Create(UserId.New(), "Héctor", "hector@example.com", Given.Now);
        var id = persona.Id;

        persona.Deactivate();

        Assert.False(persona.IsActive);
        Assert.Equal(id, persona.Id);
    }
}
