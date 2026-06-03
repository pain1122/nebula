<x-app-layout>
    <x-slot name="header">
        <h2 class="font-semibold text-xl text-gray-800 leading-tight">{{ __('My Services') }}</h2>
    </x-slot>

    <div class="py-6">
        <div class="max-w-3xl mx-auto sm:px-6 lg:px-8 space-y-4">
            @if (session('status'))
                <div class="rounded-md bg-green-100 p-4 text-green-800">{{ session('status') }}</div>
            @endif

            @php
                $selectedCheckupIds = $profile && method_exists($profile, 'checkups')
                    ? $profile->checkups()->pluck('checkups.id')->all()
                    : [];
            @endphp

            <form method="POST" action="{{ route('doctor.services.update') }}" class="rounded-lg bg-white p-6 shadow-sm space-y-3">
                @csrf
                @method('PUT')

                @forelse ($checkups as $checkup)
                    <label class="flex items-center gap-2 border-b border-gray-100 py-2 text-sm text-gray-700">
                        <input
                            type="checkbox"
                            name="checkups[]"
                            value="{{ $checkup->id }}"
                            @checked(in_array($checkup->id, $selectedCheckupIds, true))
                        >
                        <span>{{ $checkup->title }}</span>
                        <span class="text-xs text-gray-500">({{ $checkup->category?->name }})</span>
                        <span class="ms-auto text-xs text-gray-600">{{ number_format($checkup->price) }} {{ __('IRR') }}</span>
                    </label>
                @empty
                    <p class="text-gray-600">{{ __('No checkups available.') }}</p>
                @endforelse

                <div class="flex justify-end pt-3">
                    <button type="submit" class="inline-flex rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500">
                        {{ __('Save') }}
                    </button>
                </div>
            </form>
        </div>
    </div>
</x-app-layout>
