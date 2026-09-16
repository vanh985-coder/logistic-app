# ADR 0003: 3D InstancedMesh Rendering & Interaction Strategy (Phase 5 Preparation)

## Context
Màn hình 3D (React Three Fiber + Three.js) là điểm nhấn quan trọng nhất của LOGIX-3D. Hệ thống phải render mô hình container chứa tới 500 kiện hàng và duy trì mượt mà **60 FPS** trên cả máy tính bàn và thiết bị di động/tablet của nhân viên kho CFS.

Để đạt được hiệu năng này, bắt buộc phải sử dụng `InstancedMesh` (giảm hàng trăm draw calls xuống còn 1-2 draw calls). Tuy nhiên, `InstancedMesh` đặt ra 2 thách thức kỹ thuật lớn:
1. **Nhãn mã kiện (Text labels):** `InstancedMesh` dùng chung geometry và shader material, không thể gắn các nhãn văn bản (text string) khác nhau lên từng instance như Mesh thông thường. Nếu gắn 500 `<Html>` component của `@react-three/drei` vào 500 vị trí, số lượng DOM node và tính toán layout sẽ làm sập hiệu năng (FPS tụt dưới 15).
2. **Tương tác click chọn kiện (Raycasting & Event handling):** Tương tác người dùng không diễn ra trên từng đối tượng Mesh riêng lẻ mà phải thông qua `instanceId` từ ma trận chuyển vị của `InstancedMesh`.

## Decision

### 1. Phương án xử lý Nhãn mã kiện (Package Labeling)
Áp dụng cơ chế **Phân tầng hiển thị thông minh (On-Demand & Level of Detail - LOD)**:
* **Chế độ quan sát chung (Default):**
  - Sử dụng `instancedMesh.setColorAt(instanceId, color)` để phân biệt trực quan chủ hàng (Chủ hàng A màu xanh, Chủ hàng B màu cam, v.v.).
  - Không render hàng trăm nhãn text đồng thời trong không gian 3D.
* **Chế độ tương tác chi tiết (Interactive Hover / Selection):**
  - Sử dụng một (01) `<Html>` marker hoặc Billboard Canvas Sprite động duy nhất. Khi con trỏ chuột hover hoặc chạm (touch) vào bất kỳ kiện nào, marker này sẽ di chuyển tức thì đến tọa độ tâm của kiện đó và hiển thị `sku` + kích thước.
* **Chế độ kiểm tra theo lớp (Layer Inspection Mode):**
  - Khi thủ kho CFS kéo thanh trượt lớp (Layer Slider) để kiểm tra lớp hiện tại (thường từ 10–30 kiện/lớp), chỉ kích hoạt nhãn text cho các kiện thuộc lớp đang active.
* **Sidebar Inspector:** Click vào kiện sẽ ghim (pin) toàn bộ thông tin chi tiết của kiện đó lên panel cố định bên phải (Mã kiện, Tên hàng, Kích thước $L \times W \times H$, Khối lượng, Tọa độ $X,Y,Z$, Thứ tự dỡ hàng LIFO).

### 2. Phương án bắt sự kiện Click / Raycasting qua `instanceId`
* **Cấu trúc dữ liệu ánh xạ $O(1)$:**
  Duy trì một mảng ánh xạ hai chiều:
  - `instanceToPackageId: string[]` (chỉ số mảng chính là `instanceId`).
  - `packageMap: Map<string, PlacedPackage>` lưu chi tiết tọa độ và kích thước.
* **Xử lý Raycast trong React Three Fiber:**
  ```tsx
  <instancedMesh
    ref={meshRef}
    args={[boxGeometry, material, totalPackages]}
    onClick={(e) => {
      e.stopPropagation();
      if (e.instanceId !== undefined) {
        const packageData = instanceToPackageMap[e.instanceId];
        setSelectedPackage(packageData);
        highlightSelectedInstance(e.instanceId);
      }
    }}
    onPointerMove={(e) => {
      if (e.instanceId !== undefined) {
        setHoveredInstanceId(e.instanceId);
      }
    }}
    onPointerOut={() => setHoveredInstanceId(null)}
  />
  ```
* **Hiệu ứng trực quan khi kiện được chọn:**
  - Lấy ma trận vị trí của instance được chọn: `meshRef.current.getMatrixAt(instanceId, matrix)`.
  - Đặt một khung viền viền sáng (Bounding Wireframe / Highlight Box) đè lên vị trí của kiện đó mà không cần clone lại toàn bộ mesh.

## Consequences
- Duy trì ổn định 60 FPS với 500 kiện hàng.
- Trải nghiệm người dùng mượt mà, trực quan, không bị rối mắt bởi hàng trăm chữ số đè chéo nhau trong không gian hẹp của lòng container.
