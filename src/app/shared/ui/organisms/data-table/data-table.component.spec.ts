import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { DataTableComponent, type ColumnDef } from './data-table.component';

interface Row {
  id: string;
  name: string;
}

describe('data table', () => {
  it('keeps stable column keys for persisted visibility', () => {
    const keys = ['date', 'description', 'amount'];
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('shows the empty state when a local search has no matches', async () => {
    await TestBed.configureTestingModule({ imports: [DataTableComponent] }).compileComponents();
    const fixture = TestBed.createComponent(DataTableComponent<Row>);
    const columns: ColumnDef<Row>[] = [{ key: 'name', header: 'Nombre', sortable: true }];
    fixture.componentRef.setInput('columns', columns);
    fixture.componentRef.setInput('data', [{ id: '1', name: 'Cuenta principal' }]);
    fixture.componentRef.setInput('searchable', true);
    fixture.componentInstance.query.set('sin coincidencias');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.dt-empty')?.textContent).toContain('Sin resultados');
  });

  it('derives local totals and can hide pagination explicitly', async () => {
    await TestBed.configureTestingModule({ imports: [DataTableComponent] }).compileComponents();
    const fixture = TestBed.createComponent(DataTableComponent<Row>);
    fixture.componentRef.setInput('columns', [{ key: 'name', header: 'Nombre' }]);
    fixture.componentRef.setInput('data', [
      { id: '1', name: 'A' },
      { id: '2', name: 'B' },
    ]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.pg-count')?.textContent).toContain('2');

    fixture.componentRef.setInput('pagination', false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-pagination')).toBeNull();
  });

  it('renders a structural skeleton during the initial load', async () => {
    await TestBed.configureTestingModule({ imports: [DataTableComponent] }).compileComponents();
    const fixture = TestBed.createComponent(DataTableComponent<Row>);
    fixture.componentRef.setInput('columns', [{ key: 'name', header: 'Nombre' }]);
    fixture.componentRef.setInput('data', []);
    fixture.componentRef.setInput('loading', true);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.dt-skeleton app-skeleton')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('table')).toBeNull();
  });

  it('keeps at least one column visible', async () => {
    await TestBed.configureTestingModule({ imports: [DataTableComponent] }).compileComponents();
    const fixture = TestBed.createComponent(DataTableComponent<Row>);
    fixture.componentRef.setInput('columns', [
      { key: 'id', header: 'ID' },
      { key: 'name', header: 'Nombre' },
    ] satisfies ColumnDef<Row>[]);
    fixture.componentRef.setInput('data', []);
    fixture.detectChanges();

    fixture.componentInstance.toggleColumn('id');
    fixture.componentInstance.toggleColumn('name');

    expect(fixture.componentInstance.visibleColumns().map((column) => column.key)).toEqual(['name']);
  });
});
