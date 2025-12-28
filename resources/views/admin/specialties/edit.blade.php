<x-app-layout>
  <x-slot name="header"><h2 class="font-semibold text-xl">ویرایش تخصص</h2></x-slot>
  <div class="max-w-xl mx-auto p-4">
    <form method="POST" action="{{ route('admin.specialties.update',$item) }}" class="bg-white p-4 rounded shadow space-y-3">
      @csrf @method('PUT')
      <div>
        <label class="block mb-1">نام</label>
        <input name="name" value="{{ old('name',$item->name) }}" class="w-full border rounded p-2"/>
        @error('name') <div class="text-red-600 text-sm">{{ $message }}</div> @enderror
      </div>
      <div>
        <label class="block mb-1">Slug (اختیاری)</label>
        <input name="slug" value="{{ old('slug',$item->slug) }}" class="w-full border rounded p-2"/>
        @error('slug') <div class="text-red-600 text-sm">{{ $message }}</div> @enderror
      </div>
      <div>
        <label class="block mb-1">والد (اختیاری)</label>
        <select name="parent_id" class="w-full border rounded p-2">
          <option value="">— بدون والد —</option>
          @foreach($parents as $p)
            <option value="{{ $p->id }}" @selected(old('parent_id',$item->parent_id)==$p->id)>{{ $p->name }}</option>
          @endforeach
        </select>
        @error('parent_id') <div class="text-red-600 text-sm">{{ $message }}</div> @enderror
      </div>
      <div class="flex justify-end">
        <button class="px-4 py-2 bg-blue-600 text-white rounded">ذخیره</button>
      </div>
    </form>
  </div>
</x-app-layout>
