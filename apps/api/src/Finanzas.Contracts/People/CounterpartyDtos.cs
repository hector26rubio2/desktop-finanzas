using Finanzas.Contracts.Common;
using Finanzas.Contracts.Ledger;

namespace Finanzas.Contracts.People;

/// <summary>Persona con la que existen deudas o cuentas por cobrar.</summary>
/// <param name="Id">Identificador de la persona.</param>
/// <param name="DisplayName">Nombre visible.</param>
/// <param name="Alias">Apodo con el que se la reconoce en la interfaz.</param>
/// <param name="Email">Correo de contacto.</param>
/// <param name="Phone">Teléfono de contacto.</param>
/// <param name="Notes">Notas libres.</param>
/// <param name="IsActive">Sigue en uso.</param>
/// <param name="CreatedAt">Instante de creación.</param>
public sealed record CounterpartyDto(
    Guid Id,
    string DisplayName,
    string? Alias,
    string? Email,
    string? Phone,
    string? Notes,
    bool IsActive,
    DateTimeOffset CreatedAt);

/// <summary>
/// Posición de deuda frente a una persona: las dos caras, cada una por su lado.
/// </summary>
/// <remarks>
/// <para><b>No hay campo neto, y no es un olvido</b> (regla financiera 3). Lo que
/// se debe al emisor de una tarjeta sigue siendo del titular aunque exista un
/// deudor: compensar ambas cifras esconde una deuda que igual hay que pagar y da
/// por cobrado un dinero que todavía no llegó.</para>
/// <para>La interfaz puede mostrar las dos cifras juntas; lo que no puede es
/// restarlas y llamar a eso el saldo de la persona.</para>
/// </remarks>
/// <param name="Counterparty">Persona a la que corresponde la posición.</param>
/// <param name="OwnDebt">Lo que el titular debe a esa persona.</param>
/// <param name="Receivable">Lo que esa persona debe al titular.</param>
/// <param name="AsOf">Fecha hasta la que se acumularon las entradas.</param>
public sealed record DebtPositionDto(
    LinkRefDto Counterparty,
    MoneyDto OwnDebt,
    MoneyDto Receivable,
    DateOnly AsOf);

/// <summary>Alta de una persona.</summary>
/// <param name="DisplayName">Nombre visible.</param>
/// <param name="Alias">Apodo.</param>
/// <param name="Email">Correo de contacto.</param>
/// <param name="Phone">Teléfono de contacto.</param>
/// <param name="Notes">Notas libres.</param>
public sealed record CreateCounterpartyRequest(
    string DisplayName,
    string? Alias = null,
    string? Email = null,
    string? Phone = null,
    string? Notes = null);

/// <summary>Edición de una persona.</summary>
/// <param name="DisplayName">Nombre visible.</param>
/// <param name="Alias">Apodo.</param>
/// <param name="Email">Correo de contacto.</param>
/// <param name="Phone">Teléfono de contacto.</param>
/// <param name="Notes">Notas libres.</param>
/// <param name="IsActive">Activa o archivada.</param>
public sealed record UpdateCounterpartyRequest(
    string DisplayName,
    string? Alias,
    string? Email,
    string? Phone,
    string? Notes,
    bool IsActive);
