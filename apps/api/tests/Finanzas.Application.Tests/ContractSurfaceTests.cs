using System.Runtime.CompilerServices;

namespace Finanzas.Application.Tests;

/// <summary>
/// Prueba de instantánea de la superficie de <c>Finanzas.Contracts</c>: el
/// mecanismo con el que se congela el contrato (<c>HANDOFF.md</c> §2).
/// </summary>
/// <remarks>
/// <para>Congelar no significa "no cambiar nunca", significa que no se puede
/// cambiar por accidente. Mientras el frontend construye contra estos tipos,
/// renombrar una propiedad o volver anulable un campo rompe código que ya no
/// está en este repositorio. La instantánea convierte ese riesgo en un fallo de
/// construcción con el cambio exacto a la vista.</para>
/// <para><b>Cómo actualizarla.</b> Cuando el cambio sea intencionado, borre
/// <c>ContractSurface.approved.txt</c> y ejecute las pruebas: se regenera y
/// falla una vez. Revise el <c>diff</c> —esa revisión es el punto de todo
/// esto—, anúncielo en el handoff y confírmelo en el mismo <i>commit</i>.</para>
/// </remarks>
public class ContractSurfaceTests
{
    [Fact]
    public void La_superficie_publica_del_contrato_coincide_con_la_instantanea_aprobada()
    {
        var actual = ContractSurface.Dump(typeof(Finanzas.Contracts.Ledger.MovementDto).Assembly);
        var path = ApprovedPath();

        if (!File.Exists(path))
        {
            File.WriteAllText(path, actual);
            Assert.Fail(
                $"No había instantánea aprobada. Se escribió una en {path}. " +
                "Revise el contenido y confírmelo si describe el contrato que quiere congelar.");
        }

        var approved = File.ReadAllText(path).ReplaceLineEndings("\n");

        Assert.Equal(approved, actual);
    }

    /// <summary>
    /// La instantánea vive junto al código fuente de la prueba, no en la carpeta
    /// de salida: es un archivo versionado que se revisa en el <c>diff</c>.
    /// </summary>
    private static string ApprovedPath([CallerFilePath] string sourceFile = "") =>
        Path.Combine(Path.GetDirectoryName(sourceFile)!, "ContractSurface.approved.txt");
}
