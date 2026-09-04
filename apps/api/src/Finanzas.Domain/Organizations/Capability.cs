namespace Finanzas.Domain.Organizations;

/// <summary>
/// Lo que una persona puede hacer dentro de una organización.
/// </summary>
/// <remarks>
/// <para><b>Capacidades, no roles.</b> La autorización se decide contra estas
/// banderas y nunca contra un nombre de rol. "Administrador" es un atajo para
/// escribir un conjunto de capacidades al crear la membresía, no algo que el
/// sistema consulte después: en cuanto el código pregunta <c>si es admin</c>,
/// cambiar los permisos de una persona obliga a tocar código en vez de datos.
/// </para>
/// <para>Los valores son potencias de dos y forman parte del contrato de
/// persistencia: se guardan como un entero. Añadir una capacidad usa el
/// siguiente bit libre; <b>nunca</b> se reutiliza el bit de una retirada,
/// porque las membresías ya guardadas lo interpretarían como la nueva.</para>
/// </remarks>
[Flags]
public enum Capability
{
    None = 0,

    /// <summary>Ver el ledger, los saldos y los reportes.</summary>
    ViewLedger = 1 << 0,

    /// <summary>Registrar, reclasificar y reversar movimientos.</summary>
    RecordMovements = 1 << 1,

    /// <summary>Crear y editar cuentas y categorías.</summary>
    ManageAccounts = 1 << 2,

    /// <summary>Crear y editar tarjetas y sus condiciones.</summary>
    ManageCards = 1 << 3,

    /// <summary>Crear y editar personas, obligaciones y abonos.</summary>
    ManagePeople = 1 << 4,

    /// <summary>Crear y editar posiciones de inversión y sus valoraciones.</summary>
    ManageInvestments = 1 << 5,

    /// <summary>Crear, pausar y materializar recurrentes.</summary>
    ManageRecurrences = 1 << 6,

    /// <summary>Emitir liquidaciones por persona y periodo.</summary>
    IssueSettlements = 1 << 7,

    /// <summary>Exportar los datos de la organización.</summary>
    ExportData = 1 << 8,

    /// <summary>Invitar personas y cambiar sus capacidades.</summary>
    ManageMembers = 1 << 9,

    /// <summary>Cambiar los ajustes de la organización.</summary>
    ManageOrganization = 1 << 10,
}

/// <summary>
/// Conjuntos de capacidades de uso corriente. Son plantillas para escribir una
/// membresía, no roles que el sistema consulte: una vez creada, la membresía
/// guarda capacidades y nadie vuelve a preguntar de qué conjunto salieron.
/// </summary>
public static class CapabilitySets
{
    /// <summary>Solo mirar. No puede registrar ni un movimiento.</summary>
    public const Capability Viewer = Capability.ViewLedger;

    /// <summary>El uso diario: registra dinero y mantiene el maestro de datos.</summary>
    public const Capability Contributor =
        Capability.ViewLedger |
        Capability.RecordMovements |
        Capability.ManageAccounts |
        Capability.ManageCards |
        Capability.ManagePeople |
        Capability.ManageInvestments |
        Capability.ManageRecurrences |
        Capability.IssueSettlements |
        Capability.ExportData;

    /// <summary>Todo lo anterior más el gobierno de la organización.</summary>
    public const Capability Owner =
        Contributor |
        Capability.ManageMembers |
        Capability.ManageOrganization;
}
