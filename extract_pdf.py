import pdfplumber
import io

pdf_files = [
    ("C:/Users/HUAWEI/Downloads/FateTell 2.0 MVP 产品需求文档 (PRD).pdf", "mvp_prd.txt"),
    ("C:/Users/HUAWEI/Downloads/FateTell 2.0 产品规划：AI 原生玄学平台 _Nexus Ora_.pdf", "full_prd.txt")
]

for pdf_path, output_file in pdf_files:
    print(f"正在处理: {pdf_path}")
    
    try:
        with pdfplumber.open(pdf_path) as pdf:
            with open(output_file, 'w', encoding='utf-8') as f:
                for i, page in enumerate(pdf.pages):
                    text = page.extract_text()
                    if text:
                        f.write(f"\n=== 第 {i+1} 页 ===\n\n")
                        f.write(text)
                        f.write("\n\n")
        print(f"已保存到: {output_file}")
    except Exception as e:
        print(f"错误: {e}")
