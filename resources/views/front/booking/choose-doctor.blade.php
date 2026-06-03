<x-app-layout>
    <x-slot name="header">
        <h2 class="font-semibold text-xl text-gray-800 leading-tight">
            {{ __('Choose a Doctor') }} - {{ $checkup->title }}
        </h2>
    </x-slot>

    <div class="py-6">
        <div class="max-w-7xl mx-auto sm:px-6 lg:px-8 space-y-6">
            <div>
                <a href="{{ route('book.choose-checkup') }}" class="text-sm text-indigo-600 hover:text-indigo-500">
                    {{ __('Back to checkups') }}
                </a>
            </div>

            <div class="bg-white shadow-sm sm:rounded-lg p-6">
                @if ($doctors->count())
                    <div class="grid gap-4 md:grid-cols-2">
                        @foreach ($doctors as $doctor)
                            <article class="rounded-lg border border-gray-200 p-4 flex flex-col gap-3">
                                <h3 class="text-lg font-semibold text-gray-900">
                                    {{ $doctor->user?->name ?? __('Doctor #:id', ['id' => $doctor->id]) }}
                                </h3>
                                <p class="text-sm text-gray-600">
                                    {{ $doctor->specialty?->name ?? __('No specialty set') }}
                                </p>
                                <p class="text-sm text-gray-600">
                                    {{ __('Fee') }}: {{ number_format($doctor->fee) }} {{ __('IRR') }}
                                </p>
                                <a
                                    href="{{ route('book.pick-time', ['checkup' => $checkup, 'doctor' => $doctor]) }}"
                                    class="inline-flex justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
                                >
                                    {{ __('Pick Time') }}
                                </a>
                            </article>
                        @endforeach
                    </div>
                @else
                    <p class="text-gray-600">
                        {{ __('No verified doctors are currently available for this checkup.') }}
                    </p>
                @endif
            </div>
        </div>
    </div>
</x-app-layout>
