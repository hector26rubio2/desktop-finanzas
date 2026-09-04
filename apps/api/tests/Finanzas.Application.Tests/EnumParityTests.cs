using ContractsAccounts = Finanzas.Contracts.Accounts;
using ContractsCategories = Finanzas.Contracts.Categories;
using ContractsCommon = Finanzas.Contracts.Common;
using ContractsInvestments = Finanzas.Contracts.Investments;
using ContractsLedger = Finanzas.Contracts.Ledger;
using ContractsObligations = Finanzas.Contracts.Obligations;
using ContractsPurchases = Finanzas.Contracts.Purchases;
using ContractsRecurrences = Finanzas.Contracts.Recurrences;
using DomainAccounts = Finanzas.Domain.Accounts;
using DomainCategories = Finanzas.Domain.Categories;
using DomainInvestments = Finanzas.Domain.Investments;
using DomainLedger = Finanzas.Domain.Ledger;
using DomainObligations = Finanzas.Domain.Obligations;
using DomainPurchases = Finanzas.Domain.Purchases;
using DomainRecurrences = Finanzas.Domain.Recurrences;

namespace Finanzas.Application.Tests;

/// <summary>
/// <c>Contracts</c> no referencia a <c>Domain</c>: esa flecha no existe en la
/// dirección de dependencias, para que congelar el contrato no congele el
/// modelo. El precio es que cada enum vive por duplicado, y un duplicado sin
/// prueba se desincroniza el día que alguien añada una clase de movimiento y
/// olvide la mitad.
/// </summary>
/// <remarks>
/// Estas pruebas cobran ese precio: comparan nombre y valor numérico de cada
/// par, y exigen que todo enum del contrato esté declarado como espejo o como
/// deliberadamente propio del transporte. No hay tercera categoría, así que un
/// enum nuevo no puede pasar sin decidir cuál es.
/// </remarks>
public class EnumParityTests
{
    /// <summary>Pares espejo: enum del contrato y su gemelo en el dominio.</summary>
    private static readonly (Type Contract, Type Domain)[] Mirrors =
    [
        (typeof(ContractsLedger.MovementKindDto), typeof(DomainLedger.MovementKind)),
        (typeof(ContractsLedger.EconomicEffectDto), typeof(DomainLedger.EconomicEffect)),
        (typeof(ContractsLedger.CashFlowDto), typeof(DomainLedger.CashFlow)),
        (typeof(ContractsLedger.MovementOriginDto), typeof(DomainLedger.MovementOrigin)),
        (typeof(ContractsLedger.MovementLinkDto), typeof(DomainLedger.MovementLink)),
        (typeof(ContractsLedger.OperationKindDto), typeof(DomainLedger.OperationKind)),
        (typeof(ContractsAccounts.AccountKindDto), typeof(DomainAccounts.AccountKind)),
        (typeof(ContractsCategories.CategoryTypeDto), typeof(DomainCategories.CategoryType)),
        (typeof(ContractsObligations.ObligationDirectionDto), typeof(DomainObligations.ObligationDirection)),
        (typeof(ContractsObligations.ObligationOriginDto), typeof(DomainObligations.ObligationOrigin)),
        (typeof(ContractsObligations.ObligationStatusDto), typeof(DomainObligations.ObligationStatus)),
        (typeof(ContractsObligations.ObligationEntryTypeDto), typeof(DomainObligations.ObligationEntryType)),
        (typeof(ContractsObligations.PaymentAllocationRuleDto), typeof(DomainObligations.PaymentAllocationRule)),
        (typeof(ContractsObligations.InterestPolicyKindDto), typeof(DomainObligations.InterestPolicyKind)),
        (typeof(ContractsObligations.RatePeriodDto), typeof(DomainObligations.RatePeriod)),
        (typeof(ContractsInvestments.RiskLevelDto), typeof(DomainInvestments.RiskLevel)),
        (typeof(ContractsInvestments.InvestmentOperationTypeDto), typeof(DomainInvestments.InvestmentOperationType)),
        (typeof(ContractsInvestments.ValuationSourceDto), typeof(DomainInvestments.ValuationSource)),
        (typeof(ContractsRecurrences.RecurrenceKindDto), typeof(DomainRecurrences.RecurrenceKind)),
        (typeof(ContractsRecurrences.RecurrenceFrequencyDto), typeof(DomainRecurrences.RecurrenceFrequency)),
        (typeof(ContractsPurchases.ShareBasisDto), typeof(DomainPurchases.ShareBasis)),
    ];

    /// <summary>
    /// Enums que existen solo en el transporte y no tienen gemelo en el dominio:
    /// hablan de cómo se pide y se pinta una lista, no de qué es legal en el
    /// ledger. El dominio no sabe de orden ni de paginación.
    /// </summary>
    private static readonly Type[] TransportOnly =
    [
        typeof(ContractsCommon.SortDirectionDto),
        typeof(ContractsLedger.MovementSortFieldDto),
        typeof(ContractsLedger.ReversalFilterDto),
    ];

    public static TheoryData<string> MirrorNames()
    {
        var data = new TheoryData<string>();
        foreach (var (contract, _) in Mirrors)
        {
            data.Add(contract.FullName!);
        }

        return data;
    }

    [Theory]
    [MemberData(nameof(MirrorNames))]
    public void Cada_enum_del_contrato_declara_los_mismos_nombres_y_valores_que_el_dominio(string contractTypeName)
    {
        var (contract, domain) = Mirrors.Single(m => m.Contract.FullName == contractTypeName);

        Assert.Equal(Members(domain), Members(contract));
    }

    [Fact]
    public void Todo_enum_del_contrato_es_espejo_del_dominio_o_propio_del_transporte()
    {
        var declared = Mirrors.Select(m => m.Contract).Concat(TransportOnly).ToHashSet();

        var undeclared = typeof(ContractsLedger.MovementDto).Assembly
            .GetExportedTypes()
            .Where(t => t.IsEnum && !declared.Contains(t))
            .Select(t => t.FullName!)
            .Order()
            .ToArray();

        Assert.True(
            undeclared.Length == 0,
            $"Enums del contrato sin declarar como espejo ni como propios del transporte: {string.Join(", ", undeclared)}. " +
            "Añádalos a Mirrors si el dominio ya tiene el concepto, o a TransportOnly si de verdad no lo tiene.");
    }

    [Fact]
    public void El_sufijo_Dto_no_es_decorativo_nombra_al_gemelo()
    {
        foreach (var (contract, domain) in Mirrors)
        {
            Assert.Equal(domain.Name + "Dto", contract.Name);
        }
    }

    /// <summary>Nombre y valor de cada miembro, en orden estable.</summary>
    private static string[] Members(Type enumType) =>
        Enum.GetValues(enumType)
            .Cast<object>()
            .Select(value => $"{Enum.GetName(enumType, value)} = {Convert.ToInt64(value)}")
            .Order(StringComparer.Ordinal)
            .ToArray();
}
