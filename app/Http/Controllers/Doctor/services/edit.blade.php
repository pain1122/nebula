<x-app-layout>
  <x-slot name="header"><h2 class="font-semibold text-xl">سرویس‌های من</h2></x-slot>
  <div class="py-6">
    <div class="max-w-3xl mx-auto sm:px-6 lg:px-8">
      @if (session('status'))
        <div class="mb-4 p-3 rounded bg-green-100 text-green-800">{{ session('status') }}</div>
      @endif

      <form method="POST" action="{{ route('doctor.services.update') }}" class="bg-white p-6 rounded shadow space-y-3">
        @csrf @method('PUT')
        @foreach($checkups as $c)
          <label class="flex items-center gap-2 border-b py-2">
            <input type="checkbox" name="checkups[]" value="{{ $c->id }}" @checked($profile->checkups->contains($c->id))>
            <span>{{ $c->title }}</span>
            <span class="text-xs text-gray-500">({{ $c->category?->name }})</span>
            <span class="text-xs text-gray-600 ms-auto">{{ number_format($c->price) }} ریال</span>
          </label>
        @endforeach
        <div class="flex justify-end pt-3">
          <button class="px-4 py-2 bg-blue-600 text-white rounded">ذخیره</button>
        </div>
      </form>
    </div>
  </div>
</x-app-layout>
