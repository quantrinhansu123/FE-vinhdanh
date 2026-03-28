# Layout Spacing Specifications

Tài liệu này quy định các khoảng cách chuẩn (padding) giữa vùng nội dung chính với Sidebar và Header cho các trang Admin Dashboard.

## 1. Container chính (Main Content Wrapper)

Sử dụng cấu trúc này tại component chứa trang (Page Component) để đảm bảo tính đồng nhất:

```tsx
<main className="flex-1 overflow-y-auto pt-8 pb-16 px-6 lg:px-10 relative">
  {/* Nội dung trang của bạn đặt ở đây */}
</main>
```

### Chi tiết thông số:
- **Padding Top (`pt-8`)**: `32px` - Tạo khoảng thở dưới Header.
- **Padding Bottom (`pb-16`)**: `64px` - Tránh nội dung sát mép dưới màn hình.
- **Padding Left/Right (`px-6`)**: `24px` - Khoảng cách an toàn với Sidebar trên thiết bị nhỏ.
- **Padding Left/Right Desktop (`lg:px-10`)**: `40px` - Khoảng cách rộng rãi hơn trên màn hình lớn.

## 2. Cấu trúc Card bên trong nội dung (Inside Content)

Các component như `EmployeeTeamAdminPanel` nên sử dụng class `crm-glass-card` kết hợp với padding nội bộ:

```tsx
<div className="crm-glass-card rounded-2xl overflow-hidden border border-crm-outline/30">
  {/* Card Header */}
  <div className="px-6 lg:px-8 py-5 border-b border-crm-outline/30 bg-crm-surface-accent/30">
    <h2 className="text-xl font-bold tracking-tight">Tiêu đề trang</h2>
  </div>

  {/* Card Body */}
  <div className="p-6 lg:p-8">
    {/* Form hoặc Table */}
  </div>
</div>
```

### Padding của Card:
- **Header Padding**: `px-6 lg:px-8 py-5`
- **Body Padding**: `p-6 lg:p-8`
