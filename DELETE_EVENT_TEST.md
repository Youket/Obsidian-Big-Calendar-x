# 删除事件功能测试文档

## 功能说明

新的删除事件功能已经重写，现在能够：

1. **正确识别事件边界**：以 `- ` 开头的行为事件行
2. **删除事件及其备注**：从当前事件行到下一个事件行之间的所有内容
3. **处理最后一个事件**：如果是最后一个事件，删除到文件末尾
4. **详细日志输出**：方便排查问题
5. **支持用户自定义路径**：使用 Obsidian 中用户设置的日记文件路径

## 测试用例

### 测试文件内容示例

假设日记文件 `/2025-9-1.md` 内容如下：

```markdown
# 2025-09-01

## 日程安排

- 09:00-10:00 c
	33333
- [ ] b 🛫 2025-09-12 📅 2025-09-13
	2
	
	- [ ] test2
	test2
- [ ] a 🛫 2025-09-12 📅 2025-09-13
	- [ ] 1
	111
	
	test1
```

### 测试场景

#### 场景1：删除中间事件 "b"
**预期结果**：删除从 `- [ ] b` 到 `- [ ] a` 之间的所有内容
**删除后文件内容**：
```markdown
# 2025-09-01

## 日程安排

- 09:00-10:00 c
	33333
- [ ] a 🛫 2025-09-12 📅 2025-09-13
	- [ ] 1
	111
	
	test1
```

#### 场景2：删除第一个事件 "c"
**预期结果**：删除从 `- 09:00-10:00 c` 到 `- [ ] b` 之间的所有内容
**删除后文件内容**：
```markdown
# 2025-09-01

## 日程安排

- [ ] b 🛫 2025-09-12 📅 2025-09-13
	2
	
	- [ ] test2
	test2
- [ ] a 🛫 2025-09-12 📅 2025-09-13
	- [ ] 1
	111
	
	test1
```

#### 场景3：删除最后一个事件 "a"
**预期结果**：删除从 `- [ ] a` 到文件末尾的所有内容
**删除后文件内容**：
```markdown
# 2025-09-01

## 日程安排

- 09:00-10:00 c
	33333
- [ ] b 🛫 2025-09-12 📅 2025-09-13
	2
	
	- [ ] test2
	test2
```

## 日志输出说明

删除过程中会输出详细的日志信息：

```
🗑️ [DELETE_EVENT] Starting deletion process
🗑️ [DELETE_EVENT] Event ID: 2025090109000002
🗑️ [DELETE_EVENT] Event path: /2025-9-1.md
🗑️ [DELETE_EVENT] Event title: b
✅ [DELETE_EVENT] File found: /2025-9-1.md
📄 [DELETE_EVENT] Total lines in file: 16
📋 [DELETE_EVENT] All file lines:
   0: # 2025-09-01
   1: 
   2: ## 日程安排
   3: 
   4: - 09:00-10:00 c
   5: 	33333
   6: - [ ] b 🛫 2025-09-12 📅 2025-09-13
   7: 	2
   8: 	
   9: 	- [ ] test2
   10: 	test2
   11: - [ ] a 🛫 2025-09-12 📅 2025-09-13
   12: 	- [ ] 1
   13: 111
   14: 	
   15: 	test1
🔍 [DELETE_EVENT] Trying to match by event title: b
✅ [DELETE_EVENT] Found event by title match at line: 6
🎯 [DELETE_EVENT] Target line found at index: 6
🎯 [DELETE_EVENT] Target line content: - [ ] b 🛫 2025-09-12 📅 2025-09-13
🔍 [DELETE_EVENT] Finding event boundaries...
📍 [DELETE_EVENT] Event starts at line: 6
📍 [DELETE_EVENT] Found next event at line: 11
📏 [DELETE_EVENT] Event boundaries: start=6 end=10
📏 [DELETE_EVENT] Lines to delete: 5
🗑️ [DELETE_EVENT] Content to delete:
   6: - [ ] b 🛫 2025-09-12 📅 2025-09-13
   7: 	2
   8: 	
   9: 	- [ ] test2
   10: 	test2
💾 [DELETE_EVENT] Writing updated content to file...
📊 [DELETE_EVENT] Original lines: 16
📊 [DELETE_EVENT] New lines: 11
📊 [DELETE_EVENT] Deleted lines: 5
✅ [DELETE_EVENT] Event deleted successfully from file
```

## 使用方法

1. **重新加载插件**：在 Obsidian 中禁用并重新启用 Big Calendar 插件
2. **测试删除**：右键点击任意事件，选择"删除事件"
3. **查看日志**：打开浏览器开发者工具的控制台查看详细日志
4. **验证结果**：检查日记文件中的事件和备注是否被正确删除

## 技术实现

### 事件ID格式
- 格式：`YYYYMMDDHHmm00lineIndex`
- 示例：`2025090109000002` 表示 2025年9月1日9点，第2个事件（不是第2行）
- **重要**：`lineIndex` 是事件在文件中的索引（第几个事件），不是行号

### 事件查找逻辑（多重匹配策略）
1. **方法1 - 标题匹配**：通过事件标题在文件中查找匹配的事件行
2. **方法2 - 时间匹配**：从事件ID中提取时间信息（HH:mm），在文件中查找包含该时间的事件行
3. **方法3 - 索引匹配**：作为备选方案，使用原始的事件索引查找方法
4. 确定该事件的实际行号
5. 基于实际行号进行删除操作

### 为什么需要多重匹配策略？
- 事件ID中的索引是基于创建时的行号
- 删除事件后，文件行号发生变化，但事件ID中的索引没有更新
- 通过标题和时间匹配可以更可靠地找到目标事件

### 边界识别逻辑
1. 事件行：以 `- ` 开头的行
2. 备注行：以制表符 `\t` 开头的行
3. 停止条件：遇到下一个事件行或标题行（`#` 开头）

### 文件操作
1. 读取文件内容并分行
2. 根据事件ID找到目标行
3. 识别事件边界
4. 删除指定范围的行
5. 重新构建文件内容并写入

## 注意事项

1. **备份重要数据**：测试前请备份重要的日记文件
2. **检查日志**：如果删除失败，请查看控制台日志排查问题
3. **文件路径**：确保事件有正确的文件路径信息
4. **权限问题**：确保 Obsidian 有写入文件的权限
