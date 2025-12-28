<x-app-layout>
    <x-slot name="header">
        <h2 class="font-semibold text-xl">ایجاد دسته</h2>
    </x-slot>
    <div class="max-w-xl mx-auto p-4">
        <form method="POST" action="{{ route('admin.checkup-categories.store') }}"
            class="bg-white p-4 rounded shadow space-y-3">
            @csrf
            <div>
                <label class="block mb-1">نام</label>
                <input name="name" value="{{ old('name') }}" class="w-full border rounded p-2" />
                @error('name') <div class="text-red-600 text-sm">{{ $message }}</div> @enderror
            </div>
            <div>
                <label class="block mb-1">Slug</label>
                <input name="slug" value="{{ old('slug') }}" class="w-full border rounded p-2" />
                @error('slug') <div class="text-red-600 text-sm">{{ $message }}</div> @enderror
            </div>
            <div>
                <label class="block mb-1">توضیحات</label>
                <textarea name="description" rows="3" class="w-full border rounded p-2">{{ old('description') }}</textarea>
                @error('description') <div class="text-red-600 text-sm">{{ $message }}</div> @enderror
            </div>
            @foreach ($errors->all() as $e) <div class="text-red-600 text-sm">{{ $e }}</div> @endforeach
            <div class="flex justify-end"><button class="px-4 py-2 bg-blue-600 text-white rounded">ثبت</button></div>
        </form>
    </div>
</x-app-layout>