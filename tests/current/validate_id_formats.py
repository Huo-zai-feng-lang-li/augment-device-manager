#!/usr/bin/env python3
"""
VS Code ID格式验证工具
"""
import re
import uuid

def validate_machine_id(machine_id):
    """验证machineId格式"""
    if not machine_id:
        return False, "ID为空"
    
    if len(machine_id) != 64:
        return False, f"长度错误：{len(machine_id)}，应为64"
    
    if not re.match(r'^[0-9a-f]{64}$', machine_id):
        return False, "格式错误：应为64位十六进制字符串"
    
    return True, "格式正确"

def validate_device_id(device_id):
    """验证devDeviceId格式"""
    if not device_id:
        return False, "ID为空"
    
    if len(device_id) != 36:
        return False, f"长度错误：{len(device_id)}，应为36"
    
    uuid_pattern = r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    if not re.match(uuid_pattern, device_id):
        return False, "格式错误：应为标准UUID v4格式"
    
    try:
        uuid.UUID(device_id, version=4)
        return True, "格式正确"
    except ValueError:
        return False, "UUID格式无效"

def generate_sample_ids():
    """生成示例ID"""
    # 生成machineId（64位十六进制）
    machine_id = uuid.uuid4().hex + uuid.uuid4().hex
    
    # 生成devDeviceId（标准UUID v4）
    device_id = str(uuid.uuid4())
    
    return machine_id, device_id

def main():
    print("=" * 60)
    print("VS Code ID格式验证工具")
    print("=" * 60)
    
    # 你当前的ID
    current_machine_id = "da509e8655c167eaea7f593f490fe5d888ef9ac425435f1d8ebb48c98069b832"
    current_device_id = "cc176289-a9be-4a7b-9cae-186cda23c17d"
    
    print("当前ID验证：")
    print("-" * 40)
    
    # 验证当前machineId
    is_valid, msg = validate_machine_id(current_machine_id)
    print(f"machineId: {current_machine_id}")
    print(f"验证结果: {'✅' if is_valid else '❌'} {msg}")
    print()
    
    # 验证当前devDeviceId
    is_valid, msg = validate_device_id(current_device_id)
    print(f"devDeviceId: {current_device_id}")
    print(f"验证结果: {'✅' if is_valid else '❌'} {msg}")
    print()
    
    # 生成新的示例ID
    print("新ID示例：")
    print("-" * 40)
    new_machine_id, new_device_id = generate_sample_ids()
    
    print(f"新machineId: {new_machine_id}")
    is_valid, msg = validate_machine_id(new_machine_id)
    print(f"验证结果: {'✅' if is_valid else '❌'} {msg}")
    print()
    
    print(f"新devDeviceId: {new_device_id}")
    is_valid, msg = validate_device_id(new_device_id)
    print(f"验证结果: {'✅' if is_valid else '❌'} {msg}")
    print()
    
    # ID格式说明
    print("ID格式说明：")
    print("-" * 40)
    print("machineId:")
    print("  - 长度：64个字符")
    print("  - 格式：十六进制字符串")
    print("  - 字符集：0-9, a-f")
    print("  - 示例：da509e8655c167eaea7f593f490fe5d888ef9ac425435f1d8ebb48c98069b832")
    print()
    print("devDeviceId:")
    print("  - 长度：36个字符（包含连字符）")
    print("  - 格式：xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx")
    print("  - 字符集：0-9, a-f, 连字符(-)")
    print("  - 示例：cc176289-a9be-4a7b-9cae-186cda23c17d")

if __name__ == "__main__":
    main()
