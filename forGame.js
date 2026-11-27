document.body.ondragstart = () => false; // Отключаем возможность перетаскивать картинки по экрану при зажатии клавиши
document.addEventListener('contextmenu', e => e.preventDefault()); //Отключение контекстного меню на ПКМ на пк и андроид
document.addEventListener('selectstart', e => e.preventDefault()); //Отключаем выделение текста