<x-app-layout>
    <x-slot name="header">
        <h2 class="font-semibold text-xl">{{ $title }}</h2>
    </x-slot>

    <div class="max-w-xl mx-auto p-4">
        <div class="bg-white p-5 rounded shadow space-y-4">
            <p class="font-semibold">{{ $itemLabel }}</p>
            <p class="text-sm text-gray-700">{{ $warning }}</p>

            <form method="POST" action="{{ $action }}" class="flex justify-end gap-3">
                @csrf
                @method('DELETE')

                @foreach($actionData as $name => $value)
                    @if(! is_null($value))
                        <input type="hidden" name="{{ $name }}" value="{{ $value }}">
                    @endif
                @endforeach

                <a href="{{ $cancelUrl }}" class="px-4 py-2 border rounded">انصراف</a>
                <button type="submit" class="px-4 py-2 bg-amber-600 text-white rounded">تایید بایگانی</button>
            </form>
        </div>
    </div>
</x-app-layout>
