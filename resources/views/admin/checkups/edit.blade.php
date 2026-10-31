<x-app-layout>
    <x-slot name="header">
        <h2 class="font-semibold text-xl">ایجاد چکاپ</h2>
    </x-slot>
    <div class="max-w-xl mx-auto p-4">
        <form method="POST" action="{{ route('admin.checkups.update', $item) }}" class="bg-white p-4 rounded shadow space-y-3">
            @csrf
            @include('admin.catalog.guard', ['kind' => 'checkups', 'catalogId' => $item->id, 'needsReason' => false])
            @method('PUT')
            <div>
                <label class="block mb-1">دسته</label>
                <select name="checkup_category_id" class="w-full border rounded p-2">
                    <option value="">No category</option>
                    @foreach($cats as $c)
                        <option value="{{ $c->id }}" @selected(old('checkup_category_id',$item->checkup_category_id)==$c->id)>{{ $c->name }}</option>
                    @endforeach
                </select>
                @error('checkup_category_id') <div class="text-red-600 text-sm">{{ $message }}</div> @enderror
            </div>
            <div>
                <label class="block mb-1">عنوان</label>
                <input name="title" value="{{ old('title',$item->title) }}" class="w-full border rounded p-2" />
                @error('title') <div class="text-red-600 text-sm">{{ $message }}</div> @enderror
            </div>
            <div>
                <label class="block mb-1">Slug</label>
                <input name="slug" value="{{ old('slug',$item->slug) }}" class="w-full border rounded p-2" />
                @error('slug') <div class="text-red-600 text-sm">{{ $message }}</div> @enderror
            </div>
            <div>
                <label class="block mb-1">قیمت</label>
                <input name="price" type="number" min="0" value="{{ old('price',$item->price) }}" class="w-full border rounded p-2" />
                @error('price') <div class="text-red-600 text-sm">{{ $message }}</div> @enderror
            </div>
            <div>
                <label class="block mb-1">کد ارز</label>
                <input name="currency" maxlength="3" value="{{ old('currency',$item->currency) }}" class="w-full border rounded p-2 uppercase" />
                @error('currency') <div class="text-red-600 text-sm">{{ $message }}</div> @enderror
            </div>
            <div>
                <label class="block mb-1">مدت پیش‌فرض ویزیت (دقیقه)</label>
                <input name="default_duration_minutes" type="number" min="5" max="720" value="{{ old('default_duration_minutes',$item->default_duration_minutes) }}" class="w-full border rounded p-2" />
                @error('default_duration_minutes') <div class="text-red-600 text-sm">{{ $message }}</div> @enderror
            </div>
            <div>
                <label class="block mb-1">توضیحات</label>
                <textarea name="description" rows="3" class="w-full border rounded p-2">{{ old('description',$item->description) }}</textarea>
                @error('description') <div class="text-red-600 text-sm">{{ $message }}</div> @enderror
            </div>
            <div>
                <label class="block mb-1">دلیل تغییر</label>
                <textarea name="reason" rows="2" class="w-full border rounded p-2">{{ old('reason') }}</textarea>
                @error('reason') <div class="text-red-600 text-sm">{{ $message }}</div> @enderror
            </div>
            @foreach ($errors->all() as $e) <div class="text-red-600 text-sm">{{ $e }}</div> @endforeach
            <div class="flex justify-end"><button class="px-4 py-2 bg-blue-600 text-white rounded">ثبت</button></div>
        </form>
    </div>
</x-app-layout>
