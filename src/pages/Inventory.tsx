import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { logger } from '@/lib/logger';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  InventoryStatsCards,
  InventoryTable,
  DeleteItemDialog,
  DeleteCategoryDialog,
  CategoryManagementDialog,
  DuplicateItemDialog,
} from '@/components/inventory';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  Plus, 
  Search, 
  Pencil,
  Package,
  AlertTriangle,
  Filter,
  ArrowUpCircle,
  ArrowDownCircle,
  RefreshCw,
  Trash2,
  Settings,
  BookOpen,
  FileDown,
  TrendingDown,
  TrendingUp,
  MessageSquareText,
  CalendarDays,
  Share2,
  Printer,
  Wallet,
  AlertOctagon,
  Hourglass,
  ShoppingCart,
} from 'lucide-react';
import { useInventory } from '@/hooks';
import { InventoryItem, InventoryCategory, InventoryStatus, MovementType, StockMovement } from '@/types';
import { useToast } from '@/hooks';
import { cn } from '@/lib/utils';
import { useLocation, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const statusColors: Record<InventoryStatus, string> = {
  in_stock: 'bg-success/10 text-success border-success/20',
  low_stock: 'bg-warning/10 text-warning border-warning/20',
  out_of_stock: 'bg-destructive/10 text-destructive border-destructive/20',
};

const statusLabels: Record<InventoryStatus, string> = {
  in_stock: 'In Stock',
  low_stock: 'Low Stock',
  out_of_stock: 'Out of Stock',
};

export default function Inventory() {
  const {
    items,
    categories,
    movements,
    isLoading,
    fetchItems,
    createItem,
    updateItem,
    recordMovement,
    deleteItem,
    createCategory,
    updateCategory,
    deleteCategory,
    // Server-side pagination
    pagedItems,
    pagedTotalCount,
    isPageLoading,
    fetchItemsPage,
  } = useInventory();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isMovementOpen, setIsMovementOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const { toast } = useToast();

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitLockRef = useRef(false);

  const [duplicateItemWarningKey, setDuplicateItemWarningKey] = useState<string | null>(null);

  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<InventoryItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [duplicateItemInfo, setDuplicateItemInfo] = useState<InventoryItem | null>(null);

  const [isSupplierLedgerOpen, setIsSupplierLedgerOpen] = useState(() => {
    const params = new URLSearchParams(location.search);
    return params.get('sl') === '1';
  });
  const [supplierLedgerKey, setSupplierLedgerKey] = useState<string>(() => {
    const params = new URLSearchParams(location.search);
    return params.get('slSupplier') || '';
  });
  const [supplierLedgerTab, setSupplierLedgerTab] = useState<'overview' | 'items' | 'movements'>(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('slTab');
    return tab === 'items' || tab === 'movements' || tab === 'overview' ? tab : 'overview';
  });
  const [supplierLedgerMovementRange, setSupplierLedgerMovementRange] = useState<'7d' | '30d' | '90d' | 'all' | 'custom'>(() => {
    const params = new URLSearchParams(location.search);
    const range = params.get('slRange');
    return range === '7d' || range === '30d' || range === '90d' || range === 'all' || range === 'custom' ? range : '30d';
  });
  const [supplierLedgerFromDate, setSupplierLedgerFromDate] = useState(() => {
    const params = new URLSearchParams(location.search);
    return params.get('slFrom') || '';
  });
  const [supplierLedgerToDate, setSupplierLedgerToDate] = useState(() => {
    const params = new URLSearchParams(location.search);
    return params.get('slTo') || '';
  });
  const [isSupplierLedgerPdfBusy, setIsSupplierLedgerPdfBusy] = useState(false);

  useEffect(() => {
    // If something external changes the URL (back/forward), reflect it in state.
    const params = new URLSearchParams(location.search);
    const shouldOpen = params.get('sl') === '1';
    const key = params.get('slSupplier') || '';
    const tabParam = params.get('slTab');
    const tab = tabParam === 'items' || tabParam === 'movements' || tabParam === 'overview' ? tabParam : 'overview';
    const rangeParam = params.get('slRange');
    const range = rangeParam === '7d' || rangeParam === '30d' || rangeParam === '90d' || rangeParam === 'all' || rangeParam === 'custom' ? rangeParam : '30d';
    const from = params.get('slFrom') || '';
    const to = params.get('slTo') || '';

    if (shouldOpen !== isSupplierLedgerOpen) setIsSupplierLedgerOpen(shouldOpen);
    if (key !== supplierLedgerKey) setSupplierLedgerKey(key);
    if (tab !== supplierLedgerTab) setSupplierLedgerTab(tab);
    if (range !== supplierLedgerMovementRange) setSupplierLedgerMovementRange(range);
    if (from !== supplierLedgerFromDate) setSupplierLedgerFromDate(from);
    if (to !== supplierLedgerToDate) setSupplierLedgerToDate(to);
  }, [location.search]);

  useEffect(() => {
    // Build a stable query string so we don't cause infinite replace() loops
    const existing = new URLSearchParams(location.search);
    const kept: Array<[string, string]> = [];
    existing.forEach((value, key) => {
      if (key === 'sl' || key === 'slSupplier' || key === 'slTab' || key === 'slRange' || key === 'slFrom' || key === 'slTo') return;
      kept.push([key, value]);
    });
    kept.sort((a, b) => (a[0] === b[0] ? a[1].localeCompare(b[1]) : a[0].localeCompare(b[0])));

    const params = new URLSearchParams();
    for (const [k, v] of kept) params.append(k, v);

    if (isSupplierLedgerOpen) {
      params.set('sl', '1');
      if (supplierLedgerKey) params.set('slSupplier', supplierLedgerKey);
      params.set('slTab', supplierLedgerTab);
      params.set('slRange', supplierLedgerMovementRange);
      if (supplierLedgerFromDate) params.set('slFrom', supplierLedgerFromDate);
      if (supplierLedgerToDate) params.set('slTo', supplierLedgerToDate);
    }

    const nextSearch = params.toString();
    const currentSearch = location.search.startsWith('?') ? location.search.slice(1) : location.search;
    if (nextSearch !== currentSearch) {
      navigate({ pathname: location.pathname, search: nextSearch ? `?${nextSearch}` : '' }, { replace: true });
    }
  }, [
    isSupplierLedgerOpen,
    supplierLedgerKey,
    supplierLedgerTab,
    supplierLedgerMovementRange,
    supplierLedgerFromDate,
    supplierLedgerToDate,
    location.pathname,
    location.search,
    navigate,
  ]);

  // Category management state
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDescription, setNewCategoryDescription] = useState('');
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  
  // Category edit/delete state
  const [editingCategory, setEditingCategory] = useState<InventoryCategory | null>(null);
  const [isDeleteCategoryOpen, setIsDeleteCategoryOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<InventoryCategory | null>(null);
  const [isDeletingCategory, setIsDeletingCategory] = useState(false);

  const [formData, setFormData] = useState({
    item_name: '',
    category_id: '',
    unit_of_measure: '',
    current_quantity: 0,
    minimum_threshold: 0,
    unit_cost: 0,
    supplier_name: '',
    supplier_contact: '',
    expiry_date: '',
  });

  const [movementData, setMovementData] = useState({
    movement_type: '' as MovementType | '',
    quantity: 0,
    unit_cost: 0,
    notes: '',
  });

  // Stats are still computed from full items list (fetched on mount)
  const stats = {
    total: items.length,
    low_stock: items.filter(i => i.status === 'low_stock').length,
    out_of_stock: items.filter(i => i.status === 'out_of_stock').length,
    total_value: items.reduce((sum, i) => sum + (i.current_quantity * (i.unit_cost || 0)), 0),
  };

  // Use server-side paginated items for display
  const currentPageItems = pagedItems;

  const suppliers = useMemo(() => {
    const normalize = (v?: string | null) => (v || '').trim();
    const map = new Map<string, { key: string; name: string; contact: string; items: InventoryItem[] }>();

    for (const item of items) {
      const name = normalize(item.supplier_name);
      const contact = normalize(item.supplier_contact);
      if (!name && !contact) continue;
      const key = `${name.toLowerCase()}|${contact.toLowerCase()}`;

      const existing = map.get(key);
      if (existing) {
        existing.items.push(item);
      } else {
        map.set(key, { key, name, contact, items: [item] });
      }
    }

    return Array.from(map.values()).sort((a, b) => {
      const nameCmp = a.name.localeCompare(b.name);
      if (nameCmp !== 0) return nameCmp;
      return a.contact.localeCompare(b.contact);
    });
  }, [items]);

  const selectedSupplier = useMemo(() => {
    if (!supplierLedgerKey) return null;
    return suppliers.find((s) => s.key === supplierLedgerKey) || null;
  }, [supplierLedgerKey, suppliers]);

  const supplierMovements = useMemo(() => {
    if (!selectedSupplier) return [] as StockMovement[];

    const normalize = (v?: string | null) => (v || '').trim().toLowerCase();
    const name = normalize(selectedSupplier.name);
    const contact = normalize(selectedSupplier.contact);

    return (movements || [])
      .filter((m) => {
        const item = m.item;
        if (!item) return false;
        const inName = normalize(item.supplier_name);
        const inContact = normalize(item.supplier_contact);
        return inName === name && inContact === contact;
      })
      .slice()
      .sort((a, b) => {
        const da = a.movement_date || a.created_at || '';
        const db = b.movement_date || b.created_at || '';
        return db.localeCompare(da);
      });
  }, [movements, selectedSupplier]);

  const supplierLedgerStats = useMemo(() => {
    if (!selectedSupplier) return null;

    const currentStockValue = selectedSupplier.items.reduce(
      (sum, it) => sum + Number(it.current_quantity || 0) * Number(it.unit_cost || 0),
      0,
    );

    const totalStockInValue = supplierMovements
      .filter((m) => m.movement_type === 'stock_in')
      .reduce((sum, m) => sum + Number(m.quantity || 0) * Number(m.unit_cost || 0), 0);

    const lastMovementDate = supplierMovements
      .map((m) => m.movement_date || m.created_at?.split('T')[0])
      .filter(Boolean)
      .sort()
      .slice(-1)[0];

    return {
      itemsCount: selectedSupplier.items.length,
      currentStockValue,
      totalStockInValue,
      lastMovementDate: lastMovementDate || null,
      movementsCount: supplierMovements.length,
    };
  }, [selectedSupplier, supplierMovements]);

  const filteredSupplierMovements = useMemo(() => {
    if (!selectedSupplier) return [] as StockMovement[];

    const toDateString = (d: Date) => {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    };

    const today = new Date();
    const end = supplierLedgerToDate ? new Date(supplierLedgerToDate) : today;
    const endStr = !Number.isNaN(end.getTime()) ? toDateString(end) : '';

    let startStr: string | null = null;
    if (supplierLedgerMovementRange === 'custom') {
      startStr = supplierLedgerFromDate || null;
    } else if (supplierLedgerMovementRange !== 'all') {
      const days = supplierLedgerMovementRange === '7d' ? 7 : supplierLedgerMovementRange === '30d' ? 30 : 90;
      const start = new Date();
      start.setDate(start.getDate() - (days - 1));
      startStr = toDateString(start);
    }

    return supplierMovements.filter((m) => {
      const d = (m.movement_date || m.created_at?.split('T')[0] || '').slice(0, 10);
      if (!d) return false;
      if (startStr && d < startStr) return false;
      if (endStr && d > endStr) return false;
      return true;
    });
  }, [selectedSupplier, supplierMovements, supplierLedgerFromDate, supplierLedgerMovementRange, supplierLedgerToDate]);

  const supplierLedgerInsights = useMemo(() => {
    if (!selectedSupplier) return null;

    const totalCurrentQty = selectedSupplier.items.reduce((sum, it) => sum + Number(it.current_quantity || 0), 0);
    const lowStockItems = selectedSupplier.items.filter((it) => it.status === 'low_stock' || it.status === 'out_of_stock');

    const stockInMovements = supplierMovements.filter((m) => m.movement_type === 'stock_in');
    const lastPurchase = stockInMovements[0] || null;

    const daysWindow = 30;
    const start = new Date();
    start.setDate(start.getDate() - (daysWindow - 1));
    const startStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;

    const stockOutLast30 = supplierMovements
      .filter((m) => m.movement_type === 'stock_out')
      .filter((m) => {
        const d = (m.movement_date || m.created_at?.split('T')[0] || '').slice(0, 10);
        return d && d >= startStr;
      })
      .reduce((sum, m) => sum + Number(m.quantity || 0), 0);

    const avgDailyUsage = stockOutLast30 / daysWindow;
    const daysOfCover = avgDailyUsage > 0 ? totalCurrentQty / avgDailyUsage : null;

    const priceByItemId = new Map<
      string,
      { avgBuyCost: number | null; lastBuyCost: number | null; prevBuyCost: number | null; deltaPct: number | null }
    >();

    const stockInByItem = new Map<string, StockMovement[]>();
    for (const m of stockInMovements) {
      const itemId = m.inventory_item_id;
      if (!itemId) continue;
      if (m.unit_cost == null) continue;
      const arr = stockInByItem.get(itemId) || [];
      arr.push(m);
      stockInByItem.set(itemId, arr);
    }

    for (const [itemId, arr] of stockInByItem.entries()) {
      const sorted = arr
        .slice()
        .sort((a, b) => {
          const da = a.movement_date || a.created_at || '';
          const db = b.movement_date || b.created_at || '';
          return db.localeCompare(da);
        });

      let sumQty = 0;
      let sumValue = 0;
      for (const m of sorted) {
        const q = Number(m.quantity || 0);
        const c = Number(m.unit_cost || 0);
        if (!q || !c) continue;
        sumQty += q;
        sumValue += q * c;
      }

      const avgBuyCost = sumQty > 0 ? sumValue / sumQty : null;
      const lastBuyCost = sorted[0]?.unit_cost != null ? Number(sorted[0].unit_cost) : null;
      const prevBuyCost = sorted[1]?.unit_cost != null ? Number(sorted[1].unit_cost) : null;
      const deltaPct = lastBuyCost != null && prevBuyCost != null && prevBuyCost !== 0 ? ((lastBuyCost - prevBuyCost) / prevBuyCost) * 100 : null;

      priceByItemId.set(itemId, { avgBuyCost, lastBuyCost, prevBuyCost, deltaPct });
    }

    return {
      totalCurrentQty,
      lowStockItems,
      lastPurchase,
      stockOutLast30,
      avgDailyUsage,
      daysOfCover,
      priceByItemId,
    };
  }, [selectedSupplier, supplierMovements]);

  const exportSupplierLedgerCsv = () => {
    if (!selectedSupplier) return;

    const esc = (v: any) => {
      const s = String(v ?? '');
      if (s.includes('"') || s.includes(',') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };

    const rows = filteredSupplierMovements.map((m) => {
      const date = (m.movement_date || m.created_at?.split('T')[0] || '').slice(0, 10);
      const itemName = m.item?.item_name || '';
      const type = m.movement_type.replace('_', ' ');
      const qty = Number(m.quantity || 0);
      const unitCost = m.unit_cost != null ? Number(m.unit_cost) : '';
      const value = unitCost !== '' ? qty * Number(unitCost) : '';
      const notes = m.notes || '';
      return [date, itemName, type, qty, unitCost, value, notes].map(esc).join(',');
    });

    const header = ['Date', 'Item', 'Type', 'Qty', 'Unit Cost', 'Value', 'Notes'].join(',');
    const csv = [header, ...rows].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');

    const safeName = (selectedSupplier.name || 'supplier')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    a.href = url;
    a.download = `supplier-ledger-${safeName || 'export'}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const getSupplierLedgerRangeLabel = () => {
    return supplierLedgerMovementRange === 'all'
      ? 'All time'
      : supplierLedgerMovementRange === 'custom'
      ? `${supplierLedgerFromDate || '-'} to ${supplierLedgerToDate || '-'}`
      : supplierLedgerMovementRange === '7d'
      ? 'Last 7 days'
      : supplierLedgerMovementRange === '30d'
      ? 'Last 30 days'
      : 'Last 90 days';
  };

  const buildSupplierLedgerPdf = async () => {
    if (!selectedSupplier || !supplierLedgerStats || !supplierLedgerInsights) {
      throw new Error('Supplier ledger data not ready');
    }

    const supplierName = selectedSupplier.name || 'Supplier';
    const supplierContact = selectedSupplier.contact || '';
    const rangeLabel = getSupplierLedgerRangeLabel();

    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const addPage = () => pdfDoc.addPage([595.28, 841.89]); // A4
    let page = addPage();
    let { width, height } = page.getSize();
    let y = height - 48;
    const marginX = 40;

    const colorText = rgb(0.12, 0.12, 0.12);
    const colorMuted = rgb(0.38, 0.38, 0.38);
    const colorBorder = rgb(0.9, 0.9, 0.9);
    const colorHeaderBg = rgb(0.965, 0.965, 0.965);
    const colorRowAlt = rgb(0.985, 0.985, 0.985);
    const colorAccent = rgb(0.2, 0.35, 0.8);
    const colorIn = rgb(0.05, 0.6, 0.4);
    const colorOut = rgb(0.85, 0.1, 0.25);
    const colorAdj = rgb(0.75, 0.45, 0.05);

    const textWidth = (text: string, size: number, isBold = false) => {
      const f = isBold ? fontBold : font;
      return f.widthOfTextAtSize(text, size);
    };

    const drawText = (text: string, x: number, size: number, isBold = false, color = colorText) => {
      page.drawText(text, { x, y, size, font: isBold ? fontBold : font, color });
    };

    const drawTextRight = (text: string, rightX: number, size: number, isBold = false, color = colorText) => {
      const w = textWidth(text, size, isBold);
      page.drawText(text, { x: rightX - w, y, size, font: isBold ? fontBold : font, color });
    };

    const nextLine = (lineHeight: number) => {
      y -= lineHeight;
      if (y < 50) {
        page = addPage();
        ({ width, height } = page.getSize());
        y = height - 48;
      }
    };

    const rule = () => {
      page.drawLine({ start: { x: marginX, y: y - 6 }, end: { x: width - marginX, y: y - 6 }, thickness: 1, color: colorBorder });
      nextLine(18);
    };

    const sectionTitle = (label: string) => {
      drawText(label, marginX, 12, true, colorText);
      nextLine(10);
      page.drawLine({ start: { x: marginX, y: y - 2 }, end: { x: width - marginX, y: y - 2 }, thickness: 1, color: colorBorder });
      nextLine(16);
    };

    drawText('Supplier Ledger', marginX, 20, true, colorText);
    nextLine(16);
    page.drawLine({ start: { x: marginX, y: y - 2 }, end: { x: marginX + 160, y: y - 2 }, thickness: 2, color: colorAccent });
    nextLine(18);

    drawText('Supplier', marginX, 9, true, colorMuted);
    drawText(`${supplierName}${supplierContact ? ` • ${supplierContact}` : ''}`, marginX + 70, 11, true, colorText);
    nextLine(16);

    drawText('Range', marginX, 9, true, colorMuted);
    drawText(rangeLabel, marginX + 70, 10, false, colorText);
    drawText('Generated', marginX + 330, 9, true, colorMuted);
    drawText(format(new Date(), 'yyyy-MM-dd HH:mm'), marginX + 400, 10, false, colorText);
    nextLine(18);
    rule();

    const kpi = [
      ['Current Stock Value', `Rs. ${supplierLedgerStats.currentStockValue.toLocaleString()}`],
      ['Stock-In Value', `Rs. ${supplierLedgerStats.totalStockInValue.toLocaleString()}`],
      ['Low Stock Items', String(supplierLedgerInsights.lowStockItems.length)],
      ['Days of Cover', supplierLedgerInsights.daysOfCover == null ? '-' : Math.max(0, supplierLedgerInsights.daysOfCover).toFixed(0)],
      ['Last Purchase Date', (supplierLedgerInsights.lastPurchase?.movement_date || supplierLedgerInsights.lastPurchase?.created_at?.split('T')[0] || '-').slice(0, 10)],
      ['Last Purchase Price', supplierLedgerInsights.lastPurchase?.unit_cost != null ? `Rs. ${Number(supplierLedgerInsights.lastPurchase.unit_cost).toLocaleString()}` : '-'],
    ];

    sectionTitle('Overview');

    for (const [label, value] of kpi) {
      drawText(label, marginX, 9, true, colorMuted);
      drawTextRight(String(value), width - marginX, 10, true, colorText);
      nextLine(16);
    }

    nextLine(4);
    rule();

    sectionTitle('Items');

    const itemsColItem = marginX;
    const itemsColCategory = marginX + 250;
    const itemsColQtyRight = marginX + 380;
    const itemsColUnitRight = marginX + 470;
    const itemsColValueRight = width - marginX;

    page.drawRectangle({ x: marginX, y: y - 14, width: width - marginX * 2, height: 18, color: colorHeaderBg });
    drawText('Item', itemsColItem, 9, true);
    drawText('Category', itemsColCategory, 9, true);
    drawTextRight('Qty', itemsColQtyRight, 9, true);
    drawTextRight('Unit Cost', itemsColUnitRight, 9, true);
    drawTextRight('Value', itemsColValueRight, 9, true);
    nextLine(18);
    page.drawLine({ start: { x: marginX, y: y - 2 }, end: { x: width - marginX, y: y - 2 }, thickness: 1, color: colorBorder });
    nextLine(12);

    const itemsSorted = selectedSupplier.items.slice().sort((a, b) => a.item_name.localeCompare(b.item_name));
    if (itemsSorted.length === 0) {
      drawText('No items', marginX, 10, false, colorMuted);
      nextLine(18);
    } else {
      for (const [idx, it] of itemsSorted.entries()) {
        const qty = Number(it.current_quantity || 0);
        const cost = Number(it.unit_cost || 0);
        const value = qty * cost;
        if (y < 80) {
          page = addPage();
          ({ width, height } = page.getSize());
          y = height - 48;

          sectionTitle('Items (cont.)');
          page.drawRectangle({ x: marginX, y: y - 14, width: width - marginX * 2, height: 18, color: colorHeaderBg });
          drawText('Item', itemsColItem, 9, true);
          drawText('Category', itemsColCategory, 9, true);
          drawTextRight('Qty', itemsColQtyRight, 9, true);
          drawTextRight('Unit Cost', itemsColUnitRight, 9, true);
          drawTextRight('Value', itemsColValueRight, 9, true);
          nextLine(18);
          page.drawLine({ start: { x: marginX, y: y - 2 }, end: { x: width - marginX, y: y - 2 }, thickness: 1, color: colorBorder });
          nextLine(12);
        }

        if (idx % 2 === 1) {
          page.drawRectangle({ x: marginX, y: y - 12, width: width - marginX * 2, height: 16, color: colorRowAlt });
        }

        drawText(String(it.item_name || '-').slice(0, 44), itemsColItem, 9, false, colorText);
        drawText(String(it.category?.name || '-').slice(0, 24), itemsColCategory, 9, false, colorMuted);
        drawTextRight(String(qty), itemsColQtyRight, 9, true, colorText);
        drawTextRight(it.unit_cost ? `Rs. ${cost.toLocaleString()}` : '-', itemsColUnitRight, 9, false, colorText);
        drawTextRight(`Rs. ${value.toLocaleString()}`, itemsColValueRight, 9, true, colorText);
        nextLine(16);
      }
    }

    nextLine(8);
    rule();

    sectionTitle('Movements');

    const movColDate = marginX;
    const movColItem = marginX + 80;
    const movColType = marginX + 270;
    const movColQtyRight = marginX + 350;
    const movColUnitRight = marginX + 440;
    const movColValueRight = width - marginX;

    page.drawRectangle({ x: marginX, y: y - 14, width: width - marginX * 2, height: 18, color: colorHeaderBg });
    drawText('Date', movColDate, 9, true);
    drawText('Item', movColItem, 9, true);
    drawText('Type', movColType, 9, true);
    drawTextRight('Qty', movColQtyRight, 9, true);
    drawTextRight('Unit Cost', movColUnitRight, 9, true);
    drawTextRight('Value', movColValueRight, 9, true);
    nextLine(18);
    page.drawLine({ start: { x: marginX, y: y - 2 }, end: { x: width - marginX, y: y - 2 }, thickness: 1, color: colorBorder });
    nextLine(12);

    if (filteredSupplierMovements.length === 0) {
      drawText('No movements', marginX, 10, false, colorMuted);
      nextLine(18);
    } else {
      for (const [idx, m] of filteredSupplierMovements.entries()) {
        const date = (m.movement_date || m.created_at?.split('T')[0] || '-').slice(0, 10);
        const itemName = (m.item?.item_name || '-').slice(0, 28);
        const type = m.movement_type.replace('_', ' ');
        const qty = Number(m.quantity || 0);
        const unitCost = Number(m.unit_cost || 0);
        const value = qty * unitCost;

        if (y < 80) {
          page = addPage();
          ({ width, height } = page.getSize());
          y = height - 48;

          sectionTitle('Movements (cont.)');
          page.drawRectangle({ x: marginX, y: y - 14, width: width - marginX * 2, height: 18, color: colorHeaderBg });
          drawText('Date', movColDate, 9, true);
          drawText('Item', movColItem, 9, true);
          drawText('Type', movColType, 9, true);
          drawTextRight('Qty', movColQtyRight, 9, true);
          drawTextRight('Unit Cost', movColUnitRight, 9, true);
          drawTextRight('Value', movColValueRight, 9, true);
          nextLine(18);
          page.drawLine({ start: { x: marginX, y: y - 2 }, end: { x: width - marginX, y: y - 2 }, thickness: 1, color: colorBorder });
          nextLine(12);
        }

        if (idx % 2 === 1) {
          page.drawRectangle({ x: marginX, y: y - 12, width: width - marginX * 2, height: 16, color: colorRowAlt });
        }

        const typeColor =
          m.movement_type === 'stock_in' ? colorIn : m.movement_type === 'stock_out' ? colorOut : colorAdj;

        drawText(date, movColDate, 8, false, colorMuted);
        drawText(itemName, movColItem, 8, true, colorText);
        drawText(type, movColType, 8, true, typeColor);
        drawTextRight(String(qty), movColQtyRight, 8, true, colorText);
        drawTextRight(m.unit_cost != null ? `Rs. ${unitCost.toLocaleString()}` : '-', movColUnitRight, 8, false, colorText);
        drawTextRight(`Rs. ${value.toLocaleString()}`, movColValueRight, 8, true, colorText);
        nextLine(16);
      }
    }

    const pdfBase64 = await pdfDoc.saveAsBase64();
    const binary = atob(pdfBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const safeName = (supplierName || 'supplier').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const fileName = `supplier-ledger-${safeName || 'export'}-${format(new Date(), 'yyyyMMdd-HHmm')}.pdf`;
    return { blob, fileName };
  };

  const triggerPdfDownload = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const downloadSupplierLedgerPdf = async () => {
    if (isSupplierLedgerPdfBusy) return;
    try {
      setIsSupplierLedgerPdfBusy(true);
      const { blob, fileName } = await buildSupplierLedgerPdf();
      triggerPdfDownload(blob, fileName);
    } catch (e: any) {
      toast({ title: 'PDF Error', description: e?.message || 'Failed to generate PDF', variant: 'destructive' });
    } finally {
      setIsSupplierLedgerPdfBusy(false);
    }
  };

  const viewSupplierLedgerPdf = async () => {
    if (isSupplierLedgerPdfBusy) return;

    try {
      setIsSupplierLedgerPdfBusy(true);
      const { blob } = await buildSupplierLedgerPdf();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      // revoke later to allow the new tab to load
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e: any) {
      toast({ title: 'PDF Error', description: e?.message || 'Failed to generate PDF', variant: 'destructive' });
    } finally {
      setIsSupplierLedgerPdfBusy(false);
    }
  };

  const shareSupplierLedgerWhatsApp = async () => {
    if (!selectedSupplier || !supplierLedgerStats || !supplierLedgerInsights) return;
    if (isSupplierLedgerPdfBusy) return;

    const supplierName = selectedSupplier.name || 'Supplier';
    const rangeLabel = getSupplierLedgerRangeLabel();

    const lastPurchaseDate = (supplierLedgerInsights.lastPurchase?.movement_date || supplierLedgerInsights.lastPurchase?.created_at || '-').slice(0, 10);
    const lastPurchaseItem = supplierLedgerInsights.lastPurchase?.item?.item_name || '-';
    const lastPurchasePrice =
      supplierLedgerInsights.lastPurchase?.unit_cost != null ? `Rs. ${Number(supplierLedgerInsights.lastPurchase.unit_cost).toLocaleString()}` : '-';

    const topItems = selectedSupplier.items
      .slice()
      .sort((a, b) => (Number(b.current_quantity || 0) * Number(b.unit_cost || 0)) - (Number(a.current_quantity || 0) * Number(a.unit_cost || 0)))
      .slice(0, 6)
      .map((it) => {
        const qty = Number(it.current_quantity || 0);
        const cost = Number(it.unit_cost || 0);
        const value = qty * cost;
        return `${it.item_name}${it.category?.name ? ` (${it.category.name})` : ''} — Qty: ${qty}, Unit: Rs. ${cost.toLocaleString()}, Value: Rs. ${value.toLocaleString()}`;
      })
      .join('\n');

    const lowStock = supplierLedgerInsights.lowStockItems
      .slice()
      .sort((a, b) => a.item_name.localeCompare(b.item_name))
      .slice(0, 10)
      .map((it) => `${it.item_name} — Qty: ${it.current_quantity}, Min: ${it.minimum_threshold}`)
      .join('\n');

    const msg =
      `SUPPLIER LEDGER\n` +
      `Supplier: ${supplierName}\n` +
      `Period: ${rangeLabel}\n` +
      `Generated: ${format(new Date(), 'yyyy-MM-dd HH:mm')}\n\n` +
      `SUMMARY\n` +
      `• Current Stock Value: Rs. ${supplierLedgerStats.currentStockValue.toLocaleString()}\n` +
      `• Total Stock-In Value: Rs. ${supplierLedgerStats.totalStockInValue.toLocaleString()}\n` +
      `• Stock-out (Last 30 Days): ${supplierLedgerInsights.stockOutLast30.toLocaleString()}\n` +
      `• Low Stock Items: ${supplierLedgerInsights.lowStockItems.length}\n` +
      `• Days of Cover: ${supplierLedgerInsights.daysOfCover == null ? '-' : Math.max(0, supplierLedgerInsights.daysOfCover).toFixed(0)}\n\n` +
      `LAST PURCHASE\n` +
      `• Date: ${lastPurchaseDate}\n` +
      `• Item: ${lastPurchaseItem}\n` +
      `• Unit Price: ${lastPurchasePrice}\n\n` +
      (lowStock ? `LOW STOCK (Top ${Math.min(10, supplierLedgerInsights.lowStockItems.length)})\n${lowStock}\n\n` : '') +
      (topItems ? `TOP ITEMS BY STOCK VALUE\n${topItems}\n\n` : '') +
      `PDF\n` +
      `The ledger PDF has been downloaded. Please attach it here in WhatsApp.`;

    const raw = (selectedSupplier.contact || '').trim();
    const digits = raw.replace(/\D+/g, '');
    const phone = digits.startsWith('0') ? digits.slice(1) : digits;
    const waUrl = `https://wa.me/${phone || ''}?text=${encodeURIComponent(msg)}`;

    // Always open WhatsApp immediately (direct-to-WhatsApp) to avoid user-gesture / popup issues.
    const waWindow = window.open(waUrl, '_blank', 'noopener,noreferrer');
    if (!waWindow) {
      toast({ title: 'Popup Blocked', description: 'Please allow popups to open WhatsApp.', variant: 'destructive' });
      return;
    }

    try {
      setIsSupplierLedgerPdfBusy(true);
      const { blob, fileName } = await buildSupplierLedgerPdf();
      // PDF is downloaded so you can attach it in WhatsApp.
      triggerPdfDownload(blob, fileName);
    } catch (e: any) {
      logger.error('WhatsApp share error:', e);
      toast({ title: 'Share Error', description: 'Could not open WhatsApp. Please check your connection or try again.', variant: 'destructive' });
    } finally {
      setIsSupplierLedgerPdfBusy(false);
    }
  };

  // Pagination calculations (server-side)
  const totalItems = pagedTotalCount;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startIndex = totalItems === 0 ? -1 : (currentPage - 1) * pageSize;
  const endIndex = totalItems === 0 ? 0 : Math.min(startIndex + currentPageItems.length, totalItems);

  // Helper to refresh current page after mutations
  const refreshCurrentPage = useCallback(() => {
    fetchItemsPage({
      page: currentPage,
      pageSize,
      searchQuery,
      categoryFilter,
      statusFilter,
    });
    // Also refresh full items list for stats
    fetchItems();
  }, [currentPage, pageSize, searchQuery, categoryFilter, statusFilter, fetchItemsPage, fetchItems]);

  // Fetch page when filters or page changes
  useEffect(() => {
    fetchItemsPage({
      page: currentPage,
      pageSize,
      searchQuery,
      categoryFilter,
      statusFilter,
    });
  }, [currentPage, pageSize, searchQuery, categoryFilter, statusFilter, fetchItemsPage]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, categoryFilter, statusFilter]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const q = params.get('q');
    if (q && q !== searchQuery) setSearchQuery(q);
  }, [location.search, searchQuery]);

  const handleCategoryFilterChange = (value: string) => {
    if (value === '__manage_categories__') {
      setIsCategoryDialogOpen(true);
      return;
    }

    setCategoryFilter(value);
  };

  const generateItemCode = () => {
    try {
      // Prefer UUID when available
      const uuid = (globalThis as any).crypto?.randomUUID?.();
      if (uuid) return `ITM-${uuid}`;
    } catch {
      // ignore
    }
    const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
    const ts = Date.now().toString(36).toUpperCase();
    return `ITM-${ts}-${rand}`;
  };

  const openCreateForm = () => {
    setFormMode('create');
    setFormData({
      item_name: '',
      category_id: '',
      unit_of_measure: '',
      current_quantity: 0,
      minimum_threshold: 0,
      unit_cost: 0,
      supplier_name: '',
      supplier_contact: '',
      expiry_date: '',
    });
    setDuplicateItemWarningKey(null);
    setIsFormOpen(true);
  };

  const openEditForm = (item: InventoryItem) => {
    setFormMode('edit');
    setSelectedItem(item);
    setFormData({
      item_name: item.item_name,
      category_id: item.category_id || '',
      unit_of_measure: item.unit_of_measure,
      current_quantity: item.current_quantity,
      minimum_threshold: item.minimum_threshold,
      unit_cost: item.unit_cost || 0,
      supplier_name: item.supplier_name || '',
      supplier_contact: item.supplier_contact || '',
      expiry_date: item.expiry_date || '',
    });
    setDuplicateItemWarningKey(null);
    setIsFormOpen(true);
  };

  const openMovementDialog = (item: InventoryItem) => {
    setSelectedItem(item);
    setMovementData({
      movement_type: '',
      quantity: 0,
      unit_cost: item.unit_cost || 0,
      notes: '',
    });
    setIsMovementOpen(true);
  };

  const getStatus = (qty: number, threshold: number): InventoryStatus => {
    if (qty <= 0) return 'out_of_stock';
    if (qty <= threshold) return 'low_stock';
    return 'in_stock';
  };

  const submitInventoryForm = async () => {
    const result = formMode === 'create'
      ? await createItem(formData)
      : await updateItem(selectedItem!.id, formData);

    if (result.success) {
      setIsFormOpen(false);
      toast({
        title: formMode === 'create' ? 'Item Added' : 'Item Updated',
        description: formMode === 'create'
          ? `${formData.item_name} has been added to inventory`
          : 'Inventory item has been updated successfully',
      });
      // Refresh page data after mutation
      refreshCurrentPage();
    } else {
      toast({
        title: 'Error',
        description: result.error,
        variant: 'destructive',
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (submitLockRef.current) return;
    submitLockRef.current = true;

    if (isSubmitting) {
      submitLockRef.current = false;
      return;
    }
    
    if (!formData.item_name || !formData.unit_of_measure || !formData.category_id) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      submitLockRef.current = false;
      return;
    }

    if (formMode === 'create') {
      const key = `${formData.item_name.trim().toLowerCase()}|${formData.category_id}|${formData.unit_of_measure}`;
      const existing = items.find(
        (i) =>
          i.item_name.trim().toLowerCase() === formData.item_name.trim().toLowerCase() &&
          i.category_id === formData.category_id &&
          i.unit_of_measure === formData.unit_of_measure
      );

      if (existing && duplicateItemWarningKey !== key) {
        setDuplicateItemWarningKey(key);
        setDuplicateItemInfo(existing);
        setDuplicateModalOpen(true);
        setIsSubmitting(false);
        submitLockRef.current = false;
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await submitInventoryForm();
    } finally {
      setIsSubmitting(false);
      submitLockRef.current = false;
    }
  };

  const openDeleteDialog = (item: InventoryItem) => {
    setItemToDelete(item);
    setIsDeleteOpen(true);
  };

  const confirmDeleteItem = async () => {
    if (!itemToDelete) return;
    setIsDeleting(true);

    const result = await deleteItem(itemToDelete.id);

    if (result.success) {
      toast({
        title: 'Item deleted',
        description: 'The inventory item has been removed successfully.',
      });
      setIsDeleteOpen(false);
      setItemToDelete(null);
      // Refresh page data after deletion
      refreshCurrentPage();
    } else {
      toast({
        title: 'Error',
        description: result.error || 'Failed to delete item',
        variant: 'destructive',
      });
    }

    setIsDeleting(false);
  };

  const handleDuplicateConfirm = async () => {
    setDuplicateModalOpen(false);
    setDuplicateItemInfo(null);
    setDuplicateItemWarningKey(null);
    if (submitLockRef.current) return;
    submitLockRef.current = true;
    setIsSubmitting(true);
    try {
      await submitInventoryForm();
    } finally {
      setIsSubmitting(false);
      submitLockRef.current = false;
    }
  };

  const handleDuplicateCancel = () => {
    setDuplicateModalOpen(false);
    setDuplicateItemInfo(null);
    setDuplicateItemWarningKey(null);
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newCategoryName.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Category name is required',
        variant: 'destructive',
      });
      return;
    }

    setIsCreatingCategory(true);
    
    const result = await createCategory(newCategoryName.trim(), newCategoryDescription.trim() || undefined);
    
    if (result.success) {
      toast({
        title: 'Category Created',
        description: `${newCategoryName} has been added successfully`,
      });
      setNewCategoryName('');
      setNewCategoryDescription('');
      setIsCategoryDialogOpen(false);
    } else {
      toast({
        title: 'Error',
        description: result.error || 'Failed to create category',
        variant: 'destructive',
      });
    }
    
    setIsCreatingCategory(false);
  };

  const openEditCategory = (category: InventoryCategory) => {
    setEditingCategory(category);
    setNewCategoryName(category.name);
    setNewCategoryDescription(category.description || '');
  };

  const handleUpdateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editingCategory || !newCategoryName.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Category name is required',
        variant: 'destructive',
      });
      return;
    }

    setIsCreatingCategory(true);
    
    const result = await updateCategory(editingCategory.id, newCategoryName.trim(), newCategoryDescription.trim() || undefined);
    
    if (result.success) {
      toast({
        title: 'Category Updated',
        description: `${newCategoryName} has been updated successfully`,
      });
      setEditingCategory(null);
      setNewCategoryName('');
      setNewCategoryDescription('');
    } else {
      toast({
        title: 'Error',
        description: result.error || 'Failed to update category',
        variant: 'destructive',
      });
    }
    
    setIsCreatingCategory(false);
  };

  const openDeleteCategoryDialog = (category: InventoryCategory) => {
    setCategoryToDelete(category);
    setIsDeleteCategoryOpen(true);
  };

  const confirmDeleteCategory = async () => {
    if (!categoryToDelete) return;
    setIsDeletingCategory(true);

    const result = await deleteCategory(categoryToDelete.id);

    if (result.success) {
      toast({
        title: 'Category Deleted',
        description: `${categoryToDelete.name} has been removed successfully`,
      });
      setIsDeleteCategoryOpen(false);
      setCategoryToDelete(null);
    } else {
      toast({
        title: 'Error',
        description: result.error || 'Failed to delete category',
        variant: 'destructive',
      });
    }

    setIsDeletingCategory(false);
  };

  const handleMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!movementData.movement_type || movementData.quantity <= 0 || !selectedItem) {
      toast({
        title: 'Validation Error',
        description: 'Please enter a valid quantity and movement type',
        variant: 'destructive',
      });
      return;
    }

    const result = await recordMovement(selectedItem.id, {
      ...movementData,
      movement_type: movementData.movement_type as MovementType,
    });

    if (result.success) {
      setIsMovementOpen(false);
      toast({
        title: 'Stock Updated',
        description: `${selectedItem.item_name} quantity updated`,
      });
      // Refresh page data after stock movement
      refreshCurrentPage();
    } else {
      toast({
        title: 'Error',
        description: result.error,
        variant: 'destructive',
      });
    }
  };

  return (
    <TooltipProvider>
      <div className="min-h-screen">
        <Header title="Inventory" subtitle="Manage your stock and supplies" />
      
      <div className="p-4 sm:p-6 space-y-6 animate-fade-in">
        <InventoryStatsCards
          totalItems={stats.total}
          lowStockCount={stats.low_stock}
          outOfStockCount={stats.out_of_stock}
          totalValue={stats.total_value}
          onTotalClick={() => {
            setStatusFilter('all');
            setCategoryFilter('all');
            setSearchQuery('');
          }}
          onLowStockClick={() => setStatusFilter(statusFilter === 'low_stock' ? 'all' : 'low_stock')}
          onOutOfStockClick={() => setStatusFilter(statusFilter === 'out_of_stock' ? 'all' : 'out_of_stock')}
          onValueClick={() => {
            setStatusFilter('all');
            setCategoryFilter('all');
            setSearchQuery('');
          }}
        />

        {/* Actions Bar */}
        <div className="inventory-actions-bar flex flex-col gap-4">
          <div className="inventory-actions-row flex flex-col sm:flex-row gap-3">
            <div className="inventory-search relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={categoryFilter} onValueChange={handleCategoryFilterChange}>
              <SelectTrigger className="inventory-category-trigger w-full sm:w-40">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                ))}
                <div className="my-1 h-px bg-border" role="separator" />
                <SelectItem
                  value="__manage_categories__"
                  className="text-primary focus:text-primary"
                >
                  <span className="flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    <span className="font-medium">Manage Categories</span>
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="inventory-status-trigger w-36">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="in_stock">In Stock</SelectItem>
                <SelectItem value="low_stock">Low Stock</SelectItem>
                <SelectItem value="out_of_stock">Out of Stock</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="inventory-buttons-row flex flex-col sm:flex-row gap-2">
            <Button onClick={openCreateForm} className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Add Item
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => {
                setIsSupplierLedgerOpen(true);
                if (!supplierLedgerKey && suppliers.length > 0) setSupplierLedgerKey(suppliers[0].key);
              }}
            >
              <BookOpen className="h-4 w-4 mr-2" />
              Supplier Ledger
            </Button>
          </div>
        </div>

        <style>{`
          @media (hover: hover) and (pointer: fine) {
            .inventory-actions-bar {
              flex-direction: row;
              align-items: center;
              gap: 0.75rem;
            }
            .inventory-actions-row {
              flex: 1;
              flex-direction: row;
              align-items: center;
              flex-wrap: nowrap;
              gap: 0.75rem;
            }
            .inventory-search {
              flex: 0 1 36rem;
              max-width: 36rem;
            }
            .inventory-category-trigger {
              width: 10rem;
            }
            .inventory-status-trigger {
              width: 9rem;
            }
            .inventory-buttons-row {
              flex-direction: row;
              justify-content: flex-end;
            }
            .inventory-buttons-row > button {
              width: auto !important;
              white-space: nowrap;
            }
          }
        `}</style>

        {/* Items Table */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-semibold text-center w-16 whitespace-nowrap">#</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap">Item Name</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap">Category</TableHead>
                  <TableHead className="font-semibold text-center whitespace-nowrap">Current Qty</TableHead>
                  <TableHead className="font-semibold text-center whitespace-nowrap">Min Threshold</TableHead>
                  <TableHead className="font-semibold text-right whitespace-nowrap">Unit Cost</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap">Status</TableHead>
                  <TableHead className="font-semibold text-right whitespace-nowrap">Actions</TableHead>
                </TableRow>
              </TableHeader>
            <TableBody>
              {currentPageItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12">
                    {totalItems === 0 ? (
                      categories.length === 0 ? (
                        <div className="space-y-4">
                          <Package className="h-12 w-12 mx-auto text-muted-foreground" />
                          <div>
                            <h3 className="font-semibold text-lg">No categories found</h3>
                            <p className="text-muted-foreground mb-2">
                              Create your first category to start organizing inventory items
                            </p>
                            <p className="text-sm text-muted-foreground mb-4">
                              Examples: Instruments, Materials, Consumables, Medications, Equipment
                            </p>
                            <p className="text-muted-foreground">
                              Get started by adding your first inventory item
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <Package className="h-12 w-12 mx-auto text-muted-foreground" />
                          <div>
                            <h3 className="font-semibold text-lg">No items found</h3>
                            <p className="text-muted-foreground mb-4">
                              Add your first inventory item to start tracking stock.
                            </p>
                            <Button onClick={openCreateForm} className="mx-auto">
                              <Plus className="h-4 w-4 mr-2" />
                              Add Item
                            </Button>
                          </div>
                        </div>
                      )
                    ) : (
                      <div className="space-y-4">
                        <Package className="h-12 w-12 mx-auto text-muted-foreground" />
                        <div>
                          <h3 className="font-semibold text-lg">No items on this page</h3>
                          <p className="text-muted-foreground">
                            Try adjusting your filters or go to a different page
                          </p>
                        </div>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                currentPageItems.map((item, index) => (
                  <TableRow key={item.id} className="data-table-row">
                    <TableCell className="text-center text-muted-foreground font-medium">
                      {startIndex + index + 1}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{item.item_name}</div>
                      <div className="text-sm text-muted-foreground">{item.unit_of_measure}</div>
                    </TableCell>
                    <TableCell>{item.category?.name || '-'}</TableCell>
                    <TableCell className="text-center">
                      <span className={cn(
                        'font-medium',
                        item.status === 'out_of_stock' && 'text-destructive',
                        item.status === 'low_stock' && 'text-warning'
                      )}>
                        {item.current_quantity}
                      </span>
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground">{item.minimum_threshold}</TableCell>
                    <TableCell className="text-right">
                      {item.unit_cost ? `Rs. ${item.unit_cost.toLocaleString()}` : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn(statusColors[item.status])}>
                        {statusLabels[item.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openMovementDialog(item)}
                            >
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Movement</p>
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditForm(item)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Edit</p>
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openDeleteDialog(item)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Delete</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalItems > 0 && (
          <DataTablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            startIndex={startIndex}
            endIndex={endIndex}
            totalItems={totalItems}
            onPageChange={setCurrentPage}
          />
        )}
      </div>

      {/* Create/Edit Item Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{formMode === 'create' ? 'Add Inventory Item' : 'Edit Item'}</DialogTitle>
            <DialogDescription>
              {formMode === 'create' ? 'Add a new item to your inventory' : 'Update item details'}
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="form-label">Item Name *</label>
                <Input
                  value={formData.item_name}
                  onChange={(e) => setFormData({...formData, item_name: e.target.value})}
                  placeholder="Enter item name"
                  required
                />
              </div>
              <div>
                <label className="form-label">Category *</label>
                <Select value={formData.category_id} onValueChange={(v) => setFormData({...formData, category_id: v})}>
                  <SelectTrigger>
                    <SelectValue placeholder={categories.length === 0 ? "No categories available" : "Select category"} />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.length === 0 ? (
                      <div className="p-2 text-center">
                        <p className="text-sm text-muted-foreground mb-2">No categories found</p>
                        <Button 
                          type="button" 
                          variant="outline" 
                          size="sm"
                          onClick={(e) => {
                            e.preventDefault();
                            setIsCategoryDialogOpen(true);
                          }}
                        >
                          Create Category
                        </Button>
                      </div>
                    ) : (
                      categories.map(cat => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="form-label">Unit of Measure *</label>
                <Select value={formData.unit_of_measure} onValueChange={(v) => setFormData({...formData, unit_of_measure: v})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select unit" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pieces">Pieces</SelectItem>
                    <SelectItem value="box">Box</SelectItem>
                    <SelectItem value="pack">Pack</SelectItem>
                    <SelectItem value="syringe">Syringe</SelectItem>
                    <SelectItem value="kit">Kit</SelectItem>
                    <SelectItem value="strip">Strip</SelectItem>
                    <SelectItem value="bottle">Bottle</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="form-label">Current Quantity *</label>
                <Input
                  type="number"
                  min="0"
                  value={formData.current_quantity || ''}
                  onChange={(e) => setFormData({...formData, current_quantity: e.target.value === '' ? 0 : parseFloat(e.target.value)})}
                  placeholder="0"
                  required
                />
              </div>
              <div>
                <label className="form-label">Min Threshold *</label>
                <Input
                  type="number"
                  min="0"
                  value={formData.minimum_threshold || ''}
                  onChange={(e) => setFormData({...formData, minimum_threshold: e.target.value === '' ? 0 : parseFloat(e.target.value)})}
                  placeholder="0"
                  required
                />
              </div>
              <div>
                <label className="form-label">Unit Cost (Rs.)</label>
                <Input
                  type="number"
                  min="0"
                  value={formData.unit_cost || ''}
                  onChange={(e) => setFormData({...formData, unit_cost: e.target.value === '' ? 0 : parseFloat(e.target.value)})}
                  placeholder="0"
                />
              </div>
              <div>
                <label className="form-label">Supplier Name</label>
                <Input
                  value={formData.supplier_name}
                  onChange={(e) => setFormData({...formData, supplier_name: e.target.value})}
                  placeholder="Supplier name"
                />
              </div>
              <div>
                <label className="form-label">Supplier Contact</label>
                <Input
                  value={formData.supplier_contact}
                  onChange={(e) => setFormData({...formData, supplier_contact: e.target.value})}
                  placeholder="Phone number"
                />
              </div>
              <div>
                <label className="form-label">Expiry Date</label>
                <Input
                  type="date"
                  value={formData.expiry_date}
                  onChange={(e) => setFormData({...formData, expiry_date: e.target.value})}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Saving…' : (formMode === 'create' ? 'Add Item' : 'Save Changes')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Stock Movement Dialog */}
      <Dialog open={isMovementOpen} onOpenChange={setIsMovementOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Stock Movement</DialogTitle>
            <DialogDescription>
              {selectedItem?.item_name} • Current: {selectedItem?.current_quantity} {selectedItem?.unit_of_measure}
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleMovement} className="space-y-4">
            <div>
              <label className="form-label">Movement Type *</label>
              <Select value={movementData.movement_type} onValueChange={(v) => setMovementData({...movementData, movement_type: v as MovementType})}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="stock_in">
                    <div className="flex items-center gap-2">
                      <ArrowUpCircle className="h-4 w-4 text-success" />
                      Stock In
                    </div>
                  </SelectItem>
                  <SelectItem value="stock_out">
                    <div className="flex items-center gap-2">
                      <ArrowDownCircle className="h-4 w-4 text-destructive" />
                      Stock Out
                    </div>
                  </SelectItem>
                  <SelectItem value="adjustment">
                    <div className="flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 text-primary" />
                      Adjustment
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="form-label">
                {movementData.movement_type === 'adjustment' ? 'New Quantity *' : 'Quantity *'}
              </label>
              <Input
                type="number"
                min="0"
                value={movementData.quantity || ''}
                onChange={(e) => setMovementData({...movementData, quantity: e.target.value === '' ? 0 : parseFloat(e.target.value)})}
                placeholder="0"
                required
              />
            </div>

            {movementData.movement_type === 'stock_in' && (
              <div>
                <label className="form-label">Unit Cost (Rs.)</label>
                <Input
                  type="number"
                  min="0"
                  value={movementData.unit_cost || ''}
                  onChange={(e) => setMovementData({...movementData, unit_cost: e.target.value === '' ? 0 : parseFloat(e.target.value)})}
                  placeholder="0"
                />
              </div>
            )}

            {selectedItem && movementData.quantity > 0 && (
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">Preview</p>
                <p className="font-medium">
                  {selectedItem.current_quantity} 
                  {movementData.movement_type === 'stock_in' && ` + ${movementData.quantity}`}
                  {movementData.movement_type === 'stock_out' && ` - ${movementData.quantity}`}
                  {movementData.movement_type === 'adjustment' && ` → ${movementData.quantity}`}
                  {' = '}
                  <span className="text-primary">
                    {movementData.movement_type === 'stock_in' 
                      ? selectedItem.current_quantity + movementData.quantity
                      : movementData.movement_type === 'stock_out'
                        ? Math.max(0, selectedItem.current_quantity - movementData.quantity)
                        : movementData.quantity
                    }
                  </span>
                </p>
              </div>
            )}

            <div>
              <label className="form-label">Notes</label>
              <Textarea
                value={movementData.notes}
                onChange={(e) => setMovementData({...movementData, notes: e.target.value})}
                placeholder="Reason for movement"
                rows={2}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsMovementOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Update Stock</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <DeleteItemDialog
        open={isDeleteOpen}
        onOpenChange={(open) => {
          if (isDeleting) return;
          setIsDeleteOpen(open);
          if (!open) setItemToDelete(null);
        }}
        item={itemToDelete}
        isDeleting={isDeleting}
        onConfirm={confirmDeleteItem}
      />

      <CategoryManagementDialog
        open={isCategoryDialogOpen}
        onOpenChange={setIsCategoryDialogOpen}
        categories={categories}
        editingCategory={editingCategory}
        categoryName={newCategoryName}
        categoryDescription={newCategoryDescription}
        onCategoryNameChange={setNewCategoryName}
        onCategoryDescriptionChange={setNewCategoryDescription}
        onEditCategory={openEditCategory}
        onDeleteCategory={openDeleteCategoryDialog}
        onSubmit={editingCategory ? handleUpdateCategory : handleCreateCategory}
        onCancel={() => {
          setIsCategoryDialogOpen(false);
          setEditingCategory(null);
          setNewCategoryName('');
          setNewCategoryDescription('');
        }}
        isSubmitting={isCreatingCategory}
      />

      <DeleteCategoryDialog
        open={isDeleteCategoryOpen}
        onOpenChange={(open) => {
          if (isDeletingCategory) return;
          setIsDeleteCategoryOpen(open);
          if (!open) setCategoryToDelete(null);
        }}
        category={categoryToDelete}
        isDeleting={isDeletingCategory}
        onConfirm={confirmDeleteCategory}
      />

      <DuplicateItemDialog
        open={duplicateModalOpen}
        onOpenChange={(open) => {
          setDuplicateModalOpen(open);
          if (!open) {
            setDuplicateItemInfo(null);
            setDuplicateItemWarningKey(null);
          }
        }}
        duplicateItem={duplicateItemInfo}
        onViewExisting={handleDuplicateCancel}
        onCreateAnyway={handleDuplicateConfirm}
      />

      <Dialog
        open={isSupplierLedgerOpen}
        onOpenChange={(open) => {
          if (!open && isSupplierLedgerPdfBusy) {
            // Prevent closing while PDF is being generated
            return;
          }
          setIsSupplierLedgerOpen(open);
          if (!open) {
            setSupplierLedgerKey('');
            setSupplierLedgerTab('overview');
            setSupplierLedgerMovementRange('30d');
            setSupplierLedgerFromDate('');
            setSupplierLedgerToDate('');
          }
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Supplier Ledger</DialogTitle>
            <DialogDescription>
              Track supplied items and stock movements by supplier
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="form-label">Supplier</label>
                <Select
                  value={supplierLedgerKey}
                  onValueChange={(v) => setSupplierLedgerKey(v)}
                  disabled={suppliers.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={suppliers.length === 0 ? 'No suppliers found' : 'Select supplier'} />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((s) => (
                      <SelectItem key={s.key} value={s.key}>
                        {(s.name || 'Unknown Supplier') + (s.contact ? ` • ${s.contact}` : '')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="rounded-lg border bg-card p-3">
                <div className="text-xs text-muted-foreground">Contact</div>
                <div className="text-sm font-medium">{selectedSupplier?.contact || '-'}</div>
                <div className="text-xs text-muted-foreground mt-2">Supplier Name</div>
                <div className="text-sm font-medium">{selectedSupplier?.name || '-'}</div>
              </div>
            </div>

            {selectedSupplier && supplierLedgerStats && supplierLedgerInsights && (
              <Tabs value={supplierLedgerTab} onValueChange={(v) => setSupplierLedgerTab(v as any)} className="w-full">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <TabsList className="w-full sm:w-auto">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="items">Items</TabsTrigger>
                    <TabsTrigger value="movements">Movements</TabsTrigger>
                  </TabsList>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={viewSupplierLedgerPdf}
                      disabled={!selectedSupplier || isSupplierLedgerPdfBusy}
                    >
                      <Printer className="h-4 w-4 mr-2" />
                      View PDF
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={downloadSupplierLedgerPdf}
                      disabled={!selectedSupplier || isSupplierLedgerPdfBusy}
                    >
                      <Printer className="h-4 w-4 mr-2" />
                      {isSupplierLedgerPdfBusy ? 'Generating…' : 'Download PDF'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={shareSupplierLedgerWhatsApp}
                      disabled={!selectedSupplier || isSupplierLedgerPdfBusy}
                    >
                      <Share2 className="h-4 w-4 mr-2" />
                      WhatsApp
                    </Button>
                  </div>
                </div>

                <TabsContent value="overview">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 rounded-lg border border-violet-500/30 bg-gradient-to-br from-violet-500/15 via-card to-card">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Current Stock Value</div>
                          <div className="mt-1 text-xl font-semibold leading-none text-violet-700 dark:text-violet-200">Rs. {supplierLedgerStats.currentStockValue.toLocaleString()}</div>
                          <div className="mt-2 text-xs text-muted-foreground">On-hand valuation</div>
                        </div>
                        <div className="h-9 w-9 rounded-lg bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
                          <Wallet className="h-4 w-4 text-violet-700 dark:text-violet-200" />
                        </div>
                      </div>
                    </div>
                    <div className="p-3 rounded-lg border border-emerald-500/30 bg-gradient-to-br from-emerald-500/15 via-card to-card">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Stock-In Value</div>
                          <div className="mt-1 text-xl font-semibold leading-none text-emerald-700 dark:text-emerald-200">Rs. {supplierLedgerStats.totalStockInValue.toLocaleString()}</div>
                          <div className="mt-2 text-xs text-muted-foreground">Total purchase value</div>
                        </div>
                        <div className="h-9 w-9 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                          <ShoppingCart className="h-4 w-4 text-emerald-700 dark:text-emerald-200" />
                        </div>
                      </div>
                    </div>
                    <div className="p-3 rounded-lg border border-amber-500/30 bg-gradient-to-br from-amber-500/15 via-card to-card">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Low Stock Items</div>
                          <div className="mt-1 text-xl font-semibold leading-none text-amber-700 dark:text-amber-200">{supplierLedgerInsights.lowStockItems.length}</div>
                          <div className="mt-2 text-xs text-muted-foreground">Needs reorder</div>
                        </div>
                        <div className="h-9 w-9 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
                          <AlertOctagon className="h-4 w-4 text-amber-700 dark:text-amber-200" />
                        </div>
                      </div>
                    </div>
                    <div className="p-3 rounded-lg border border-sky-500/30 bg-gradient-to-br from-sky-500/15 via-card to-card">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Days of Cover</div>
                          <div className="mt-1 text-xl font-semibold leading-none text-sky-700 dark:text-sky-200">
                            {supplierLedgerInsights.daysOfCover == null ? '-' : Math.max(0, supplierLedgerInsights.daysOfCover).toFixed(0)}
                          </div>
                          <div className="mt-2 text-xs text-muted-foreground">Based on last 30 days usage</div>
                        </div>
                        <div className="h-9 w-9 rounded-lg bg-sky-500/20 border border-sky-500/30 flex items-center justify-center">
                          <Hourglass className="h-4 w-4 text-sky-700 dark:text-sky-200" />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                    <div className="p-3 rounded-lg border bg-card">
                      <div className="text-xs text-muted-foreground">Last Purchase Date</div>
                      <div className="text-sm font-medium mt-1">
                        {(supplierLedgerInsights.lastPurchase?.movement_date || supplierLedgerInsights.lastPurchase?.created_at?.split('T')[0] || '-')}
                      </div>
                    </div>
                    <div className="p-3 rounded-lg border bg-card">
                      <div className="text-xs text-muted-foreground">Last Purchase Price</div>
                      <div className="text-sm font-medium mt-1">
                        {supplierLedgerInsights.lastPurchase?.unit_cost != null
                          ? `Rs. ${Number(supplierLedgerInsights.lastPurchase.unit_cost).toLocaleString()}`
                          : '-'}
                      </div>
                    </div>
                    <div className="p-3 rounded-lg border bg-card">
                      <div className="text-xs text-muted-foreground">Avg Monthly Usage</div>
                      <div className="text-sm font-medium mt-1">{supplierLedgerInsights.stockOutLast30.toLocaleString()}</div>
                      <div className="text-xs text-muted-foreground mt-1">(Stock-out qty in last 30 days)</div>
                    </div>
                  </div>

                  {supplierLedgerInsights.lowStockItems.length > 0 && (
                    <div className="rounded-lg border bg-card mt-3 overflow-hidden">
                      <div className="px-3 py-2 border-b">
                        <div className="text-sm font-medium">Low Stock From This Supplier</div>
                        <div className="text-xs text-muted-foreground">Quick reorder shortlist</div>
                      </div>
                      <div className="p-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {supplierLedgerInsights.lowStockItems
                            .slice()
                            .sort((a, b) => a.item_name.localeCompare(b.item_name))
                            .slice(0, 8)
                            .map((it) => (
                              <div key={it.id} className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
                                <div className="min-w-0">
                                  <div className="text-sm font-medium truncate">{it.item_name}</div>
                                  <div className="text-xs text-muted-foreground">{it.category?.name || '-'}</div>
                                </div>
                                <div className="text-right pl-3">
                                  <div className="text-sm font-semibold">{it.current_quantity}</div>
                                  <div className="text-xs text-muted-foreground">min {it.minimum_threshold}</div>
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="items">
                  <div className="rounded-lg border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Item</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead className="text-right">Qty</TableHead>
                          <TableHead className="text-right">Current Cost</TableHead>
                          <TableHead className="text-right">Avg Buy Cost</TableHead>
                          <TableHead className="text-right">Trend</TableHead>
                          <TableHead className="text-right">Value</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedSupplier.items.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                              No items found for this supplier
                            </TableCell>
                          </TableRow>
                        ) : (
                          selectedSupplier.items
                            .slice()
                            .sort((a, b) => a.item_name.localeCompare(b.item_name))
                            .map((it) => {
                              const p = supplierLedgerInsights.priceByItemId.get(it.id);
                              const delta = p?.deltaPct ?? null;
                              const trendUp = delta != null && delta > 0;
                              const trendDown = delta != null && delta < 0;

                              return (
                                <TableRow key={it.id}>
                                  <TableCell className="font-medium">{it.item_name}</TableCell>
                                  <TableCell>{it.category?.name || '-'}</TableCell>
                                  <TableCell className="text-right">{it.current_quantity}</TableCell>
                                  <TableCell className="text-right">{it.unit_cost ? `Rs. ${it.unit_cost.toLocaleString()}` : '-'}</TableCell>
                                  <TableCell className="text-right">
                                    {p?.avgBuyCost != null
                                      ? `Rs. ${p.avgBuyCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                                      : '-'}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {delta == null ? (
                                      <span className="text-muted-foreground">-</span>
                                    ) : (
                                      <span
                                        className={cn(
                                          'inline-flex items-center gap-1 font-medium',
                                          trendUp && 'text-red-600 dark:text-red-400',
                                          trendDown && 'text-emerald-600 dark:text-emerald-400',
                                          !trendUp && !trendDown && 'text-muted-foreground',
                                        )}
                                      >
                                        {trendUp ? <TrendingUp className="h-4 w-4" /> : trendDown ? <TrendingDown className="h-4 w-4" /> : null}
                                        {Math.abs(delta).toFixed(1)}%
                                      </span>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right font-medium">
                                    Rs. {(Number(it.current_quantity || 0) * Number(it.unit_cost || 0)).toLocaleString()}
                                  </TableCell>
                                </TableRow>
                              );
                            })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>

                <TabsContent value="movements">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="form-label">Date Range</label>
                      <Select value={supplierLedgerMovementRange} onValueChange={(v) => setSupplierLedgerMovementRange(v as any)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select range" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="7d">Last 7 days</SelectItem>
                          <SelectItem value="30d">Last 30 days</SelectItem>
                          <SelectItem value="90d">Last 90 days</SelectItem>
                          <SelectItem value="all">All time</SelectItem>
                          <SelectItem value="custom">Custom</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className={cn(supplierLedgerMovementRange !== 'custom' && 'opacity-70')}>
                      <label className="form-label">From</label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            className={cn('w-full justify-start text-left font-normal', !supplierLedgerFromDate && 'text-muted-foreground')}
                            onClick={() => {
                              if (supplierLedgerMovementRange !== 'custom') {
                                setSupplierLedgerMovementRange('custom');
                                if (!supplierLedgerToDate) setSupplierLedgerToDate(format(new Date(), 'yyyy-MM-dd'));
                              }
                            }}
                          >
                            <CalendarDays className="mr-2 h-4 w-4" />
                            {supplierLedgerFromDate ? supplierLedgerFromDate : 'Pick a date'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={supplierLedgerFromDate ? new Date(supplierLedgerFromDate) : undefined}
                            onSelect={(d) => {
                              if (!d) {
                                setSupplierLedgerFromDate('');
                                return;
                              }
                              if (supplierLedgerMovementRange !== 'custom') setSupplierLedgerMovementRange('custom');
                              setSupplierLedgerFromDate(format(d, 'yyyy-MM-dd'));
                            }}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div className={cn(supplierLedgerMovementRange !== 'custom' && 'opacity-70')}>
                      <label className="form-label">To</label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            className={cn('w-full justify-start text-left font-normal', !supplierLedgerToDate && 'text-muted-foreground')}
                            onClick={() => {
                              if (supplierLedgerMovementRange !== 'custom') {
                                setSupplierLedgerMovementRange('custom');
                                if (!supplierLedgerFromDate) setSupplierLedgerFromDate(format(new Date(), 'yyyy-MM-dd'));
                              }
                            }}
                          >
                            <CalendarDays className="mr-2 h-4 w-4" />
                            {supplierLedgerToDate ? supplierLedgerToDate : 'Pick a date'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={supplierLedgerToDate ? new Date(supplierLedgerToDate) : undefined}
                            onSelect={(d) => {
                              if (!d) {
                                setSupplierLedgerToDate('');
                                return;
                              }
                              if (supplierLedgerMovementRange !== 'custom') setSupplierLedgerMovementRange('custom');
                              setSupplierLedgerToDate(format(d, 'yyyy-MM-dd'));
                            }}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  <div className="rounded-lg border overflow-hidden mt-3">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Item</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead className="text-right">Qty</TableHead>
                          <TableHead className="text-right">Unit Cost</TableHead>
                          <TableHead className="text-right">Value</TableHead>
                          <TableHead className="w-[56px] text-center">Notes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredSupplierMovements.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                              No stock movements in this date range
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredSupplierMovements.map((m) => (
                            <TableRow key={m.id}>
                              <TableCell className="whitespace-nowrap">
                                {(m.movement_date || m.created_at?.split('T')[0] || '-').slice(0, 10)}
                              </TableCell>
                              <TableCell className="font-medium">{m.item?.item_name || '-'}</TableCell>
                              <TableCell
                                className={
                                  'capitalize font-medium ' +
                                  (m.movement_type === 'stock_in'
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : m.movement_type === 'stock_out'
                                    ? 'text-red-600 dark:text-red-400'
                                    : 'text-amber-600 dark:text-amber-400')
                                }
                              >
                                {m.movement_type.replace('_', ' ')}
                              </TableCell>
                              <TableCell className="text-right">{m.quantity}</TableCell>
                              <TableCell className="text-right">
                                {m.unit_cost != null ? `Rs. ${Number(m.unit_cost).toLocaleString()}` : '-'}
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                Rs. {(Number(m.quantity || 0) * Number(m.unit_cost || 0)).toLocaleString()}
                              </TableCell>
                              <TableCell className="text-center">
                                {m.notes ? (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <button type="button" className="inline-flex items-center justify-center text-muted-foreground hover:text-foreground">
                                        <MessageSquareText className="h-4 w-4" />
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-[320px]">
                                      {m.notes}
                                    </TooltipContent>
                                  </Tooltip>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>
              </Tabs>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsSupplierLedgerOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      </div>
    </div>
    </TooltipProvider>
  );
}
