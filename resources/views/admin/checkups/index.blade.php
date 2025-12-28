<x-app-layout>
  <x-slot name="header"><h2 class="font-semibold text-xl">چکاپ‌ها</h2></x-slot>
  <div class="max-w-5xl mx-auto p-4">
    @if(session('status')) <div class="mb-3 p-2 bg-green-100 text-green-800 rounded">{{ session('status') }}</div> @endif
    <div class="mb-4"><a href="{{ route('admin.checkups.create') }}" class="px-3 py-2 bg-blue-600 text-white rounded">چکاپ جدید</a></div>
    <table class="w-full bg-white rounded shadow text-sm">
      <thead><tr class="border-b"><th class="p-2 text-right">عنوان</th><th class="p-2 text-right">دسته</th><th class="p-2 text-right">قیمت</th><th class="p-2">اقدامات</th></tr></thead>
      <tbody>
        @foreach($items as $it)
          <tr class="border-b">
            <td class="p-2">{{ $it->title }}</td>
            <td class="p-2">{{ $it->category?->name }}</td>
            <td class="p-2">{{ number_format($it->price) }}</td>
            <td class="p-2">
              <a class="text-blue-600" href="{{ route('admin.checkups.edit',$it) }}">ویرایش</a>
              <form action="{{ route('admin.checkups.destroy',$it) }}" method="POST" class="inline" onsubmit="return confirm('حذف شود؟')">
                @csrf @method('DELETE') <button class="text-red-600 ml-2">حذف</button>
              </form>
            </td>
          </tr>
        @endforeach
      </tbody>
    </table>
    <div class="mt-3">{{ $items->links() }}</div>
  </div>
</x-app-layout>
