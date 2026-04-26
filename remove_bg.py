from PIL import Image

def remove_bg(paths):
    for path in paths:
        try:
            img = Image.open(path).convert("RGBA")
            datas = img.getdata()
            
            newData = []
            for item in datas:
                # white background
                if item[0] > 240 and item[1] > 240 and item[2] > 240:
                    newData.append((255, 255, 255, 0))
                else:
                    newData.append(item)
                    
            img.putdata(newData)
            img.save(path, "PNG")
            print("Successfully processed " + path)
        except Exception as e:
            print("Failed " + path + ": " + str(e))

remove_bg(["public/gymmanagr-logo.png", "public/logo.png"])
