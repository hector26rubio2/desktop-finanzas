using Finanzas.Contracts.Common;
using Finanzas.Contracts.Ledger;

namespace Finanzas.Contracts.Accounts;

/// <summary>
/// Naturaleza de la cuenta. Espejo de
/// <c>Finanzas.Domain.Accounts.AccountKind</c>.
/// </summary>
/// <remarks>
/// La tarjeta de crédito no está aquí: no es una cuenta con saldo propio sino
/// una deuda con el emisor, y tiene su propio contrato en
/// <c>Finanzas.Contracts.Cards</c>.
/// </remarks>
public enum AccountKindDto
{
    Cash = 1,
    Checking = 2,
    Savings = 3,
    Wallet = 4,
    Other = 99,
}

/// <summary>Cuenta donde entra y de donde sale dinero.</summary>
/// <param name="Id">Identificador de la cuenta.</param>
/// <param name="Name">Nombre visible.</param>
/// <param name="Kind">Naturaleza de la cuenta.</param>
/// <param name="Currency">Moneda en la que opera. No cambia tras crearla.</param>
/// <param name="Institution">Entidad financiera, si aplica.</param>
/// <param name="LastFour">Últimos cuatro dígitos, para reconocerla.</param>
/// <param name="IsDefault">Cuenta preseleccionada en los formularios.</param>
/// <param name="IsActive">Sigue en uso. Una cuenta inactiva conserva su historia.</param>
/// <param name="CreatedAt">Instante de creación.</param>
public sealed record AccountDto(
    Guid Id,
    string Name,
    AccountKindDto Kind,
    string Currency,
    string? Institution,
    string? LastFour,
    bool IsDefault,
    bool IsActive,
    DateTimeOffset CreatedAt);

/// <summary>Saldo de una cuenta a una fecha, calculado sobre el ledger.</summary>
/// <remarks>
/// Es una proyección, no un campo editable (regla financiera 1). Cuadrar el
/// saldo contra el extracto se hace registrando el movimiento que falta, no
/// escribiendo la cifra a mano.
/// </remarks>
/// <param name="Account">Cuenta a la que corresponde el saldo.</param>
/// <param name="Balance">Saldo a la fecha, en la moneda de la cuenta.</param>
/// <param name="AsOf">Fecha hasta la que se acumularon los movimientos.</param>
public sealed record AccountBalanceDto(LinkRefDto Account, MoneyDto Balance, DateOnly AsOf);

/// <summary>Alta de una cuenta.</summary>
/// <remarks>
/// La moneda se fija al crear y no admite cambio: cambiarla reinterpretaría en
/// otra unidad todos los movimientos ya registrados.
/// </remarks>
/// <param name="Name">Nombre visible.</param>
/// <param name="Kind">Naturaleza de la cuenta.</param>
/// <param name="Currency">Código ISO de la moneda.</param>
/// <param name="Institution">Entidad financiera.</param>
/// <param name="LastFour">Últimos cuatro dígitos.</param>
/// <param name="IsDefault">Marcarla como cuenta preseleccionada.</param>
public sealed record CreateAccountRequest(
    string Name,
    AccountKindDto Kind,
    string Currency,
    string? Institution = null,
    string? LastFour = null,
    bool IsDefault = false);

/// <summary>Edición de una cuenta: solo lo que se puede cambiar sin reescribir el pasado.</summary>
/// <param name="Name">Nombre visible.</param>
/// <param name="Institution">Entidad financiera.</param>
/// <param name="LastFour">Últimos cuatro dígitos.</param>
/// <param name="IsDefault">Cuenta preseleccionada.</param>
/// <param name="IsActive">Activa o archivada.</param>
public sealed record UpdateAccountRequest(
    string Name,
    string? Institution,
    string? LastFour,
    bool IsDefault,
    bool IsActive);
