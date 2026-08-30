"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CategoryIcon } from "@/components/category-icon";
import { normalizeExpenseDescription } from "@/lib/expense-parser";

type DailyTotal = { date: string; day: string; total: number };
type CategoryTotal = { name: string; total: number };
type MonthlyTotal = { month: string; start: string; total: number; income?: number; expense?: number };
type DailyExpense = { id: string; fecha_gasto: string; monto: number | string | null; descripcion: string | null; categoria: string };

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(value);
}

function formatDay(date: string) {
  return new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long" }).format(new Date(`${date}T12:00:00`));
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value?: number; payload?: { date?: string; name?: string } }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const value = Number(payload[0].value ?? 0);
  const item = payload[0].payload;
  return <div className="chart-tooltip"><strong>{item?.date ? formatDay(item.date) : label}</strong><span>{formatCurrency(value)}</span></div>;
}

export function DailyExpenseChart({ dailyTotals, expenses, total }: { dailyTotals: DailyTotal[]; expenses: DailyExpense[]; total: number }) {
  const firstDayWithExpenses = dailyTotals.find((entry) => entry.total > 0)?.date ?? dailyTotals[0]?.date ?? null;
  const [selectedDate, setSelectedDate] = useState(firstDayWithExpenses);
  const selectedDayTotal = dailyTotals.find((entry) => entry.date === selectedDate)?.total ?? 0;
  const selectedExpenses = expenses.filter((expense) => expense.fecha_gasto === selectedDate);
  const chartHeight = dailyTotals.length <= 10 ? 230 : 190;

  return <div className="daily-chart"><ResponsiveContainer width="100%" height={chartHeight}><BarChart data={dailyTotals} margin={{ top: 12, right: 4, left: 0, bottom: 0 }}><CartesianGrid vertical={false} stroke="#e8e4ef" /><XAxis dataKey="day" tick={{ fill: "#77738b", fontSize: 10, fontWeight: 700 }} tickLine={false} axisLine={{ stroke: "#e8e4ef" }} interval={Math.max(Math.ceil(dailyTotals.length / 7) - 1, 0)} /><YAxis hide domain={[0, "dataMax"]} /><Tooltip content={<ChartTooltip />} cursor={{ fill: "#7564e914" }} /><Bar dataKey="total" name="Total diario" radius={[6, 6, 2, 2]} maxBarSize={dailyTotals.length <= 10 ? 48 : 24} onClick={(entry) => { const data = entry as unknown as { date?: string; payload?: DailyTotal }; const date = data.payload?.date ?? data.date; if (date) setSelectedDate(date); }}>{dailyTotals.map((entry) => <Cell key={entry.date} fill={entry.date === selectedDate ? "#e48765" : "#7564e9"} />)}</Bar></BarChart></ResponsiveContainer><div className="chart-caption"><span><i className="chart-legend" /> Total del periodo</span><strong>{formatCurrency(total)}</strong></div>{selectedDate && <div className="selected-day-detail" aria-live="polite"><div className="selected-day-heading"><div><p className="eyebrow">Total del día</p><h3>{formatDay(selectedDate)}</h3></div><strong>{formatCurrency(selectedDayTotal)}</strong></div>{selectedExpenses.length === 0 ? <p className="muted">No hubo gastos confirmados este día.</p> : <div className="selected-expense-list">{selectedExpenses.map((expense) => <div className="selected-expense-row" key={expense.id}><span className="expense-avatar"><CategoryIcon category={expense.categoria} size={17} /></span><span><strong>{normalizeExpenseDescription(expense.descripcion ?? "")}</strong><small>{expense.categoria}</small></span><strong>{formatCurrency(Number(expense.monto ?? 0))}</strong></div>)}</div>}</div>}</div>;
}

export function CategoryExpenseChart({ categories, color = "#7564e9" }: { categories: CategoryTotal[]; color?: string }) {
  const chartHeight = Math.max(220, categories.length * 42);
  return <div className="category-chart"><ResponsiveContainer width="100%" height={chartHeight}><BarChart data={categories} layout="vertical" margin={{ top: 4, right: 8, left: 8, bottom: 4 }}><CartesianGrid horizontal={false} stroke="#e8e4ef" /><XAxis type="number" hide /><YAxis type="category" dataKey="name" width={105} tick={{ fill: "#292638", fontSize: 11, fontWeight: 700 }} tickLine={false} axisLine={false} /><Tooltip content={<ChartTooltip />} cursor={{ fill: "#7564e914" }} /><Bar dataKey="total" name="Total por categoría" fill={color} radius={[0, 7, 7, 0]} maxBarSize={24} /></BarChart></ResponsiveContainer></div>;
}

export function MonthlyExpenseChart({ months }: { months: MonthlyTotal[] }) {
  const hasNetData = months.some((month) => month.income !== undefined || month.expense !== undefined);
  return <div className="monthly-chart"><ResponsiveContainer width="100%" height={280}><BarChart data={months} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}><CartesianGrid vertical={false} stroke="#e8e4ef" /><XAxis dataKey="month" tick={{ fill: "#77738b", fontSize: 11, fontWeight: 700 }} tickLine={false} axisLine={{ stroke: "#e8e4ef" }} /><YAxis hide /><Tooltip content={<ChartTooltip />} cursor={{ fill: "#7564e914" }} />{hasNetData ? <><Bar dataKey="income" name="Ingresos" fill="#5bbd9b" radius={[7, 7, 3, 3]} maxBarSize={24} /><Bar dataKey="expense" name="Gastos" fill="#e48765" radius={[7, 7, 3, 3]} maxBarSize={24} /></> : <Bar dataKey="total" name="Total mensual" fill="#7564e9" radius={[7, 7, 3, 3]} maxBarSize={42} />}</BarChart></ResponsiveContainer></div>;
}
