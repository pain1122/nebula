<x-app-layout>
  <x-slot name="header">
    <h2 class="font-semibold text-xl text-gray-800 leading-tight">داشبورد ادمین</h2>
  </x-slot>

  <div class="p-6">
    سلام {{ auth()->user()->name }} 👋
  </div>
</x-app-layout>
